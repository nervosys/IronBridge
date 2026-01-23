"""
Chasm Telemetry Server - AWS Lambda Handler
Receives telemetry records from chasm CLI and stores in S3/DynamoDB
"""

import json
import os
import boto3
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS clients (initialized outside handler for connection reuse)
s3_client = boto3.client('s3')
secrets_client = boto3.client('secretsmanager')
dynamodb_client = None

# Environment variables
S3_BUCKET = os.environ.get('S3_BUCKET')
API_KEY_SECRET_ID = os.environ.get('API_KEY_SECRET_ID')
DYNAMODB_TABLE = os.environ.get('DYNAMODB_TABLE')
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'prod')

# Cache API key to avoid repeated Secrets Manager calls
_api_key_cache = None


def get_api_key() -> str:
    """Retrieve API key from Secrets Manager (cached)"""
    global _api_key_cache
    if _api_key_cache is None:
        response = secrets_client.get_secret_value(SecretId=API_KEY_SECRET_ID)
        _api_key_cache = response['SecretString']
    return _api_key_cache


def validate_api_key(headers: dict) -> bool:
    """Validate the API key from request headers"""
    # Check multiple header formats
    api_key = (
        headers.get('x-api-key') or 
        headers.get('X-Api-Key') or
        headers.get('authorization', '').replace('Bearer ', '')
    )
    
    if not api_key:
        return False
    
    expected_key = get_api_key()
    return api_key == expected_key


def store_in_s3(records: list, installation_id: str) -> str:
    """Store records in S3 as JSONL"""
    now = datetime.now(timezone.utc)
    
    # Partition by date and installation_id for efficient querying
    # Format: data/year=YYYY/month=MM/day=DD/installation_id/batch_uuid.jsonl
    s3_key = (
        f"data/year={now.year}/month={now.month:02d}/day={now.day:02d}/"
        f"{installation_id}/{uuid4()}.jsonl"
    )
    
    # Convert records to JSONL
    jsonl_content = '\n'.join(json.dumps(record) for record in records)
    
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=s3_key,
        Body=jsonl_content.encode('utf-8'),
        ContentType='application/x-ndjson',
        Metadata={
            'installation_id': installation_id,
            'record_count': str(len(records)),
            'ingested_at': now.isoformat()
        }
    )
    
    return s3_key


def store_in_dynamodb(records: list, installation_id: str) -> int:
    """Store records in DynamoDB for real-time queries"""
    global dynamodb_client
    
    if not DYNAMODB_TABLE:
        return 0
    
    if dynamodb_client is None:
        dynamodb_client = boto3.client('dynamodb')
    
    # Calculate TTL (90 days from now)
    ttl = int(datetime.now(timezone.utc).timestamp()) + (90 * 24 * 60 * 60)
    
    # Batch write items
    items = []
    for record in records:
        # Create composite sort key: timestamp_recordid for uniqueness
        timestamp_id = f"{record.get('timestamp', 0)}_{record.get('id', uuid4())}"
        
        item = {
            'PutRequest': {
                'Item': {
                    'installation_id': {'S': installation_id},
                    'timestamp_id': {'S': timestamp_id},
                    'category': {'S': record.get('category', 'unknown')},
                    'event': {'S': record.get('event', '')},
                    'data': {'S': json.dumps(record.get('data', {}))},
                    'tags': {'SS': record.get('tags', ['_none_']) or ['_none_']},
                    'timestamp': {'N': str(record.get('timestamp', 0))},
                    'timestamp_iso': {'S': record.get('timestamp_iso', '')},
                    'ttl': {'N': str(ttl)}
                }
            }
        }
        items.append(item)
    
    # DynamoDB batch write limit is 25 items
    written = 0
    for i in range(0, len(items), 25):
        batch = items[i:i + 25]
        dynamodb_client.batch_write_item(
            RequestItems={DYNAMODB_TABLE: batch}
        )
        written += len(batch)
    
    return written


def handle_ingest(body: dict, headers: dict) -> dict:
    """Handle POST /ingest - receive and store telemetry records"""
    
    # Validate API key
    if not validate_api_key(headers):
        return {
            'statusCode': 401,
            'body': json.dumps({'error': 'Invalid or missing API key'})
        }
    
    # Validate request body
    installation_id = body.get('installation_id')
    records = body.get('records', [])
    
    if not installation_id:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Missing installation_id'})
        }
    
    if not records:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'No records provided'})
        }
    
    if len(records) > 1000:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Too many records (max 1000 per request)'})
        }
    
    # Add server-side metadata to each record
    ingested_at = datetime.now(timezone.utc).isoformat()
    for record in records:
        record['_ingested_at'] = ingested_at
        record['_installation_id'] = installation_id
    
    # Store in S3
    s3_key = store_in_s3(records, installation_id)
    logger.info(f"Stored {len(records)} records to S3: {s3_key}")
    
    # Store in DynamoDB (if enabled)
    dynamodb_count = 0
    if DYNAMODB_TABLE:
        try:
            dynamodb_count = store_in_dynamodb(records, installation_id)
            logger.info(f"Stored {dynamodb_count} records to DynamoDB")
        except Exception as e:
            logger.error(f"DynamoDB write failed: {e}")
            # Continue - S3 is primary storage
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'success': True,
            'records_received': len(records),
            's3_key': s3_key,
            'dynamodb_records': dynamodb_count
        })
    }


def handle_health() -> dict:
    """Handle GET /health - health check endpoint"""
    return {
        'statusCode': 200,
        'body': json.dumps({
            'status': 'healthy',
            'environment': ENVIRONMENT,
            's3_bucket': S3_BUCKET,
            'dynamodb_enabled': bool(DYNAMODB_TABLE),
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    }


def lambda_handler(event: dict, context: Any) -> dict:
    """Main Lambda handler"""
    
    # Log incoming request (without sensitive data)
    logger.info(f"Request: {event.get('routeKey', 'unknown')} from {event.get('requestContext', {}).get('http', {}).get('sourceIp', 'unknown')}")
    
    # Default response headers
    headers = {
        'Content-Type': 'application/json',
        'X-Request-Id': event.get('requestContext', {}).get('requestId', str(uuid4()))
    }
    
    try:
        route_key = event.get('routeKey', '')
        
        if route_key == 'GET /health':
            response = handle_health()
        
        elif route_key == 'POST /ingest':
            # Parse request body
            body_str = event.get('body', '{}')
            if event.get('isBase64Encoded'):
                import base64
                body_str = base64.b64decode(body_str).decode('utf-8')
            
            body = json.loads(body_str)
            request_headers = event.get('headers', {})
            
            response = handle_ingest(body, request_headers)
        
        else:
            response = {
                'statusCode': 404,
                'body': json.dumps({'error': f'Unknown route: {route_key}'})
            }
        
        response['headers'] = headers
        return response
    
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': 'Invalid JSON in request body'})
        }
    
    except Exception as e:
        logger.exception(f"Unhandled error: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error'})
        }
