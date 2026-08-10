// Copyright (c) 2024-2028 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! SDK Module
//!
//! Provides SDK generation and developer tooling for custom integrations.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// SDK Configuration
// ============================================================================

/// SDK configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SdkConfig {
    /// SDK version
    pub version: String,
    /// Base API URL
    pub base_url: String,
    /// Supported languages
    pub languages: Vec<SdkLanguage>,
    /// API version
    pub api_version: String,
}

/// SDK language
///
/// `ValueEnum` is derived here rather than mirrored in `cli.rs` on purpose: a
/// second copy of the variant list is a copy that can fall behind, which is
/// the same class of bug as the placeholder arm `generate()` used to have.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash, clap::ValueEnum)]
#[serde(rename_all = "lowercase")]
pub enum SdkLanguage {
    #[value(name = "python")]
    Python,
    #[value(name = "nodejs")]
    NodeJs,
    #[value(name = "go")]
    Go,
    #[value(name = "rust")]
    Rust,
    #[value(name = "java")]
    Java,
    #[value(name = "csharp")]
    CSharp,
    #[value(name = "ruby")]
    Ruby,
    #[value(name = "php")]
    Php,
}

impl SdkLanguage {
    /// Every language, so callers and tests cannot silently miss one.
    pub const ALL: [SdkLanguage; 8] = [
        SdkLanguage::Python,
        SdkLanguage::NodeJs,
        SdkLanguage::Go,
        SdkLanguage::Rust,
        SdkLanguage::Java,
        SdkLanguage::CSharp,
        SdkLanguage::Ruby,
        SdkLanguage::Php,
    ];
}

impl std::fmt::Display for SdkLanguage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SdkLanguage::Python => write!(f, "python"),
            SdkLanguage::NodeJs => write!(f, "nodejs"),
            SdkLanguage::Go => write!(f, "go"),
            SdkLanguage::Rust => write!(f, "rust"),
            SdkLanguage::Java => write!(f, "java"),
            SdkLanguage::CSharp => write!(f, "csharp"),
            SdkLanguage::Ruby => write!(f, "ruby"),
            SdkLanguage::Php => write!(f, "php"),
        }
    }
}

// ============================================================================
// SDK Templates
// ============================================================================

/// Python SDK template
pub const PYTHON_SDK_TEMPLATE: &str = r#"# Chasm Python SDK
# Auto-generated - Do not edit directly
# Version: {{version}}

"""
Chasm Python SDK

A Python client library for the Chasm API.

Usage:
    from chasm import ChasmClient
    
    client = ChasmClient(api_key="your-api-key")
    sessions = client.sessions.list()
"""

import os
import json
import requests
from typing import Optional, List, Dict, Any, Union
from dataclasses import dataclass, field
from datetime import datetime
from urllib.parse import urljoin

__version__ = "{{version}}"
__api_version__ = "{{api_version}}"


def _default_base_url() -> str:
    """The base URL from the environment, falling back to the generated default."""
    return os.environ.get("CHASM_BASE_URL") or "{{base_url}}"


def _default_api_key() -> Optional[str]:
    """The API key from the environment, or None when unauthenticated."""
    return os.environ.get("CHASM_API_KEY") or None


@dataclass
class ChasmConfig:
    """Configuration for Chasm client."""
    base_url: str = field(default_factory=_default_base_url)
    api_key: Optional[str] = field(default_factory=_default_api_key)
    timeout: int = 30
    retry_count: int = 3
    retry_delay: float = 1.0


@dataclass
class Session:
    """Represents a chat session."""
    id: str
    title: str
    provider: str
    workspace_id: Optional[str] = None
    message_count: int = 0
    token_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    tags: List[str] = field(default_factory=list)
    archived: bool = False


@dataclass
class Message:
    """Represents a chat message."""
    id: str
    session_id: str
    role: str
    content: str
    model: Optional[str] = None
    token_count: int = 0
    created_at: Optional[datetime] = None


@dataclass
class Workspace:
    """Represents a workspace."""
    id: str
    name: str
    path: str
    provider: str
    session_count: int = 0
    created_at: Optional[datetime] = None


class ChasmError(Exception):
    """Base exception for Chasm errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, response: Optional[dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class AuthenticationError(ChasmError):
    """Authentication failed."""
    pass


class RateLimitError(ChasmError):
    """Rate limit exceeded."""
    pass


class NotFoundError(ChasmError):
    """Resource not found."""
    pass


class ApiClient:
    """Low-level API client."""
    
    def __init__(self, config: ChasmConfig):
        self.config = config
        self.session = requests.Session()
        if config.api_key:
            self.session.headers["Authorization"] = f"Bearer {config.api_key}"
        self.session.headers["Content-Type"] = "application/json"
        self.session.headers["User-Agent"] = f"chasm-python/{__version__}"
    
    def request(self, method: str, path: str, **kwargs) -> dict:
        """Make an API request."""
        url = urljoin(self.config.base_url, path)
        kwargs.setdefault("timeout", self.config.timeout)
        
        response = self.session.request(method, url, **kwargs)
        
        if response.status_code == 401:
            raise AuthenticationError("Invalid API key", 401)
        elif response.status_code == 404:
            raise NotFoundError("Resource not found", 404)
        elif response.status_code == 429:
            raise RateLimitError("Rate limit exceeded", 429)
        elif response.status_code >= 400:
            raise ChasmError(f"API error: {response.text}", response.status_code)
        
        if response.content:
            return response.json()
        return {}
    
    def get(self, path: str, params: Optional[dict] = None) -> dict:
        return self.request("GET", path, params=params)
    
    def post(self, path: str, data: Optional[dict] = None) -> dict:
        return self.request("POST", path, json=data)
    
    def put(self, path: str, data: Optional[dict] = None) -> dict:
        return self.request("PUT", path, json=data)
    
    def delete(self, path: str) -> dict:
        return self.request("DELETE", path)


class SessionsResource:
    """Sessions API resource."""
    
    def __init__(self, client: ApiClient):
        self._client = client
    
    def list(
        self,
        workspace_id: Optional[str] = None,
        provider: Optional[str] = None,
        archived: Optional[bool] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Session]:
        """List sessions."""
        params = {"limit": limit, "offset": offset}
        if workspace_id:
            params["workspace_id"] = workspace_id
        if provider:
            params["provider"] = provider
        if archived is not None:
            params["archived"] = str(archived).lower()
        
        response = self._client.get("/api/sessions", params)
        return [self._parse_session(s) for s in response.get("sessions", [])]
    
    def get(self, session_id: str) -> Session:
        """Get a session by ID."""
        response = self._client.get(f"/api/sessions/{session_id}")
        return self._parse_session(response)
    
    def create(self, title: str, provider: str, workspace_id: Optional[str] = None) -> Session:
        """Create a new session."""
        data = {"title": title, "provider": provider}
        if workspace_id:
            data["workspace_id"] = workspace_id
        response = self._client.post("/api/sessions", data)
        return self._parse_session(response)
    
    def update(self, session_id: str, **kwargs) -> Session:
        """Update a session."""
        response = self._client.put(f"/api/sessions/{session_id}", kwargs)
        return self._parse_session(response)
    
    def delete(self, session_id: str) -> bool:
        """Delete a session."""
        self._client.delete(f"/api/sessions/{session_id}")
        return True
    
    def archive(self, session_id: str) -> Session:
        """Archive a session."""
        return self.update(session_id, archived=True)
    
    def search(self, query: str, limit: int = 20) -> List[Session]:
        """Search sessions."""
        response = self._client.get("/api/sessions/search", {"q": query, "limit": limit})
        return [self._parse_session(s) for s in response.get("sessions", [])]
    
    def _parse_session(self, data: dict) -> Session:
        return Session(
            id=data["id"],
            title=data.get("title", "Untitled"),
            provider=data.get("provider", "unknown"),
            workspace_id=data.get("workspace_id"),
            message_count=data.get("message_count", 0),
            token_count=data.get("token_count", 0),
            tags=data.get("tags", []),
            archived=data.get("archived", False),
        )


class WorkspacesResource:
    """Workspaces API resource."""
    
    def __init__(self, client: ApiClient):
        self._client = client
    
    def list(self, limit: int = 20, offset: int = 0) -> List[Workspace]:
        """List workspaces."""
        response = self._client.get("/api/workspaces", {"limit": limit, "offset": offset})
        return [self._parse_workspace(w) for w in response.get("workspaces", [])]
    
    def get(self, workspace_id: str) -> Workspace:
        """Get a workspace by ID."""
        response = self._client.get(f"/api/workspaces/{workspace_id}")
        return self._parse_workspace(response)
    
    def _parse_workspace(self, data: dict) -> Workspace:
        return Workspace(
            id=data["id"],
            name=data.get("name", ""),
            path=data.get("path", ""),
            provider=data.get("provider", ""),
            session_count=data.get("session_count", 0),
        )


class HarvestResource:
    """Harvest API resource."""
    
    def __init__(self, client: ApiClient):
        self._client = client
    
    def run(self, providers: Optional[List[str]] = None) -> dict:
        """Run harvest."""
        data = {}
        if providers:
            data["providers"] = providers
        return self._client.post("/api/harvest", data)
    

class ChasmClient:
    """Main Chasm client."""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        **kwargs
    ):
        config = ChasmConfig(
            api_key=api_key or _default_api_key(),
            base_url=base_url or _default_base_url(),
            **kwargs
        )
        self._api = ApiClient(config)
        
        # Resources
        self.sessions = SessionsResource(self._api)
        self.workspaces = WorkspacesResource(self._api)
        self.harvest = HarvestResource(self._api)
    
    def health(self) -> dict:
        """Check API health."""
        return self._api.get("/api/health")
    
    def stats(self) -> dict:
        """Get statistics."""
        return self._api.get("/api/stats")


# Convenience function
def create_client(**kwargs) -> ChasmClient:
    """Create a Chasm client with environment configuration."""
    return ChasmClient(**kwargs)
"#;

/// Node.js SDK template
pub const NODEJS_SDK_TEMPLATE: &str = r#"/**
 * Chasm Node.js SDK
 * Auto-generated - Do not edit directly
 * Version: {{version}}
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const VERSION = '{{version}}';
const API_VERSION = '{{api_version}}';

/**
 * Chasm client configuration
 */
class ChasmConfig {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.CHASM_BASE_URL || '{{base_url}}';
    this.apiKey = options.apiKey || process.env.CHASM_API_KEY;
    this.timeout = options.timeout || 30000;
    this.retryCount = options.retryCount || 3;
  }
}

/**
 * Custom error classes
 */
class ChasmError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = 'ChasmError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

class AuthenticationError extends ChasmError {
  constructor(message) {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

class NotFoundError extends ChasmError {
  constructor(message) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

class RateLimitError extends ChasmError {
  constructor(message) {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

/**
 * Low-level API client
 */
class ApiClient {
  constructor(config) {
    this.config = config;
  }

  async request(method, path, options = {}) {
    const url = new URL(path, this.config.baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const requestOptions = {
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `chasm-nodejs/${VERSION}`,
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
      },
      timeout: this.config.timeout,
    };

    return new Promise((resolve, reject) => {
      const req = client.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 401) {
            reject(new AuthenticationError('Invalid API key'));
          } else if (res.statusCode === 404) {
            reject(new NotFoundError('Resource not found'));
          } else if (res.statusCode === 429) {
            reject(new RateLimitError('Rate limit exceeded'));
          } else if (res.statusCode >= 400) {
            reject(new ChasmError(`API error: ${data}`, res.statusCode));
          } else {
            resolve(data ? JSON.parse(data) : {});
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new ChasmError('Request timeout'));
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      req.end();
    });
  }

  get(path, params) {
    return this.request('GET', path, { params });
  }

  post(path, body) {
    return this.request('POST', path, { body });
  }

  put(path, body) {
    return this.request('PUT', path, { body });
  }

  delete(path) {
    return this.request('DELETE', path);
  }
}

/**
 * Sessions resource
 */
class SessionsResource {
  constructor(client) {
    this._client = client;
  }

  async list(options = {}) {
    const params = {
      limit: options.limit || 20,
      offset: options.offset || 0,
      workspace_id: options.workspaceId,
      provider: options.provider,
      archived: options.archived,
    };
    const response = await this._client.get('/api/sessions', params);
    return response.sessions || [];
  }

  async get(sessionId) {
    return this._client.get(`/api/sessions/${sessionId}`);
  }

  async create(data) {
    return this._client.post('/api/sessions', data);
  }

  async update(sessionId, data) {
    return this._client.put(`/api/sessions/${sessionId}`, data);
  }

  async delete(sessionId) {
    await this._client.delete(`/api/sessions/${sessionId}`);
    return true;
  }

  async search(query, limit = 20) {
    const response = await this._client.get('/api/sessions/search', { q: query, limit });
    return response.sessions || [];
  }
}

/**
 * Workspaces resource
 */
class WorkspacesResource {
  constructor(client) {
    this._client = client;
  }

  async list(options = {}) {
    const params = {
      limit: options.limit || 20,
      offset: options.offset || 0,
    };
    const response = await this._client.get('/api/workspaces', params);
    return response.workspaces || [];
  }

  async get(workspaceId) {
    return this._client.get(`/api/workspaces/${workspaceId}`);
  }
}

/**
 * Harvest resource
 */
class HarvestResource {
  constructor(client) {
    this._client = client;
  }

  async run(providers) {
    const data = providers ? { providers } : {};
    return this._client.post('/api/harvest', data);
  }
}

/**
 * Main Chasm client
 */
class ChasmClient {
  constructor(options = {}) {
    const config = new ChasmConfig(options);
    this._api = new ApiClient(config);

    this.sessions = new SessionsResource(this._api);
    this.workspaces = new WorkspacesResource(this._api);
    this.harvest = new HarvestResource(this._api);
  }

  async health() {
    return this._api.get('/api/health');
  }

  async stats() {
    return this._api.get('/api/stats');
  }
}

module.exports = {
  ChasmClient,
  ChasmConfig,
  ChasmError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  VERSION,
  API_VERSION,
};
"#;

/// Go SDK template
pub const GO_SDK_TEMPLATE: &str = r#"// Chasm Go SDK
// Auto-generated - Do not edit directly
// Version: {{version}}

package chasm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"
)

const (
	Version    = "{{version}}"
	APIVersion = "{{api_version}}"
)

// Config holds client configuration
type Config struct {
	BaseURL    string
	APIKey     string
	Timeout    time.Duration
	RetryCount int
}

// DefaultConfig returns default configuration
func DefaultConfig() *Config {
	baseURL := os.Getenv("CHASM_BASE_URL")
	if baseURL == "" {
		baseURL = "{{base_url}}"
	}
	return &Config{
		BaseURL:    baseURL,
		APIKey:     os.Getenv("CHASM_API_KEY"),
		Timeout:    30 * time.Second,
		RetryCount: 3,
	}
}

// Session represents a chat session
type Session struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	Provider     string    `json:"provider"`
	WorkspaceID  *string   `json:"workspace_id,omitempty"`
	MessageCount int       `json:"message_count"`
	TokenCount   int       `json:"token_count"`
	Tags         []string  `json:"tags"`
	Archived     bool      `json:"archived"`
	CreatedAt    time.Time `json:"created_at,omitempty"`
	UpdatedAt    time.Time `json:"updated_at,omitempty"`
}

// Workspace represents a workspace
type Workspace struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Path         string    `json:"path"`
	Provider     string    `json:"provider"`
	SessionCount int       `json:"session_count"`
	CreatedAt    time.Time `json:"created_at,omitempty"`
}

// Error types
type ChasmError struct {
	Message    string
	StatusCode int
}

func (e *ChasmError) Error() string {
	return fmt.Sprintf("chasm: %s (status %d)", e.Message, e.StatusCode)
}

// Client is the main Chasm client
type Client struct {
	config     *Config
	httpClient *http.Client
	Sessions   *SessionsService
	Workspaces *WorkspacesService
	Harvest    *HarvestService
}

// NewClient creates a new Chasm client
func NewClient(config *Config) *Client {
	if config == nil {
		config = DefaultConfig()
	}
	
	c := &Client{
		config: config,
		httpClient: &http.Client{
			Timeout: config.Timeout,
		},
	}
	
	c.Sessions = &SessionsService{client: c}
	c.Workspaces = &WorkspacesService{client: c}
	c.Harvest = &HarvestService{client: c}
	
	return c
}

func (c *Client) request(method, path string, body interface{}, result interface{}) error {
	u, err := url.Parse(c.config.BaseURL + path)
	if err != nil {
		return err
	}

	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, u.String(), bodyReader)
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("chasm-go/%s", Version))
	if c.config.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.config.APIKey)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return &ChasmError{
			Message:    fmt.Sprintf("API error: %s", resp.Status),
			StatusCode: resp.StatusCode,
		}
	}

	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}

// Health checks API health
func (c *Client) Health() (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.request("GET", "/api/health", nil, &result)
	return result, err
}

// Stats gets statistics
func (c *Client) Stats() (map[string]interface{}, error) {
	var result map[string]interface{}
	err := c.request("GET", "/api/stats", nil, &result)
	return result, err
}

// SessionsService handles session operations
type SessionsService struct {
	client *Client
}

// ListOptions for listing resources
type ListOptions struct {
	Limit       int
	Offset      int
	WorkspaceID string
	Provider    string
	Archived    *bool
}

func (s *SessionsService) List(opts *ListOptions) ([]Session, error) {
	path := "/api/sessions"
	if opts != nil {
		params := url.Values{}
		if opts.Limit > 0 {
			params.Set("limit", fmt.Sprintf("%d", opts.Limit))
		}
		if opts.Offset > 0 {
			params.Set("offset", fmt.Sprintf("%d", opts.Offset))
		}
		if opts.WorkspaceID != "" {
			params.Set("workspace_id", opts.WorkspaceID)
		}
		if opts.Provider != "" {
			params.Set("provider", opts.Provider)
		}
		if opts.Archived != nil {
			params.Set("archived", fmt.Sprintf("%t", *opts.Archived))
		}
		if len(params) > 0 {
			path += "?" + params.Encode()
		}
	}
	
	var result struct {
		Sessions []Session `json:"sessions"`
	}
	err := s.client.request("GET", path, nil, &result)
	return result.Sessions, err
}

func (s *SessionsService) Get(id string) (*Session, error) {
	var session Session
	err := s.client.request("GET", "/api/sessions/"+id, nil, &session)
	return &session, err
}

func (s *SessionsService) Create(title, provider string, workspaceID *string) (*Session, error) {
	body := map[string]interface{}{
		"title":    title,
		"provider": provider,
	}
	if workspaceID != nil {
		body["workspace_id"] = *workspaceID
	}
	var session Session
	err := s.client.request("POST", "/api/sessions", body, &session)
	return &session, err
}

func (s *SessionsService) Delete(id string) error {
	return s.client.request("DELETE", "/api/sessions/"+id, nil, nil)
}

func (s *SessionsService) Search(query string, limit int) ([]Session, error) {
	path := fmt.Sprintf("/api/sessions/search?q=%s&limit=%d", url.QueryEscape(query), limit)
	var result struct {
		Sessions []Session `json:"sessions"`
	}
	err := s.client.request("GET", path, nil, &result)
	return result.Sessions, err
}

// WorkspacesService handles workspace operations
type WorkspacesService struct {
	client *Client
}

func (w *WorkspacesService) List(opts *ListOptions) ([]Workspace, error) {
	path := "/api/workspaces"
	if opts != nil && (opts.Limit > 0 || opts.Offset > 0) {
		params := url.Values{}
		if opts.Limit > 0 {
			params.Set("limit", fmt.Sprintf("%d", opts.Limit))
		}
		if opts.Offset > 0 {
			params.Set("offset", fmt.Sprintf("%d", opts.Offset))
		}
		path += "?" + params.Encode()
	}
	
	var result struct {
		Workspaces []Workspace `json:"workspaces"`
	}
	err := w.client.request("GET", path, nil, &result)
	return result.Workspaces, err
}

func (w *WorkspacesService) Get(id string) (*Workspace, error) {
	var workspace Workspace
	err := w.client.request("GET", "/api/workspaces/"+id, nil, &workspace)
	return &workspace, err
}

// HarvestService handles harvest operations
type HarvestService struct {
	client *Client
}

func (h *HarvestService) Run(providers []string) (map[string]interface{}, error) {
	body := map[string]interface{}{}
	if len(providers) > 0 {
		body["providers"] = providers
	}
	var result map[string]interface{}
	err := h.client.request("POST", "/api/harvest", body, &result)
	return result, err
}
"#;

// ============================================================================
// Rust SDK
// ============================================================================

pub const RUST_SDK_TEMPLATE: &str = r##"// Chasm Rust SDK
// Auto-generated - Do not edit directly
// Version: {{version}}
//
// Add to Cargo.toml:
//   reqwest = { version = "0.12", features = ["json"] }
//   serde = { version = "1", features = ["derive"] }
//   tokio = { version = "1", features = ["full"] }

use serde::{Deserialize, Serialize};
use std::time::Duration;

pub const VERSION: &str = "{{version}}";
pub const API_VERSION: &str = "{{api_version}}";

#[derive(Debug, Clone)]
pub struct Config {
    pub base_url: String,
    pub api_key: Option<String>,
    pub timeout: Duration,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            base_url: std::env::var("CHASM_BASE_URL")
                .unwrap_or_else(|_| "{{base_url}}".to_string()),
            api_key: std::env::var("CHASM_API_KEY").ok().filter(|k| !k.is_empty()),
            timeout: Duration::from_secs(30),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub provider: String,
    #[serde(default)]
    pub message_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub path: String,
}

#[derive(Debug)]
pub enum Error {
    Http(reqwest::Error),
    Api { status: u16, message: String },
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Http(e) => write!(f, "chasm: transport error: {e}"),
            Error::Api { status, message } => write!(f, "chasm: API error {status}: {message}"),
        }
    }
}

impl std::error::Error for Error {}

impl From<reqwest::Error> for Error {
    fn from(e: reqwest::Error) -> Self {
        Error::Http(e)
    }
}

pub struct Client {
    config: Config,
    http: reqwest::Client,
}

impl Client {
    pub fn new(config: Config) -> Result<Self, Error> {
        let http = reqwest::Client::builder()
            .timeout(config.timeout)
            .user_agent(format!("chasm-rust/{VERSION}"))
            .build()?;
        Ok(Self { config, http })
    }

    async fn get(&self, path: &str) -> Result<serde_json::Value, Error> {
        self.send(self.http.get(format!("{}{}", self.config.base_url, path)))
            .await
    }

    async fn post(&self, path: &str, body: serde_json::Value) -> Result<serde_json::Value, Error> {
        self.send(
            self.http
                .post(format!("{}{}", self.config.base_url, path))
                .json(&body),
        )
        .await
    }

    async fn send(&self, mut req: reqwest::RequestBuilder) -> Result<serde_json::Value, Error> {
        if let Some(key) = &self.config.api_key {
            req = req.bearer_auth(key);
        }
        let resp = req.send().await?;
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(Error::Api {
                status: status.as_u16(),
                message: text,
            });
        }
        Ok(serde_json::from_str(&text).unwrap_or(serde_json::Value::Null))
    }

    pub async fn health(&self) -> Result<serde_json::Value, Error> {
        self.get("/api/health").await
    }

    pub async fn stats(&self) -> Result<serde_json::Value, Error> {
        self.get("/api/stats").await
    }

    pub async fn list_sessions(&self, limit: Option<u32>) -> Result<serde_json::Value, Error> {
        match limit {
            Some(n) => self.get(&format!("/api/sessions?limit={n}")).await,
            None => self.get("/api/sessions").await,
        }
    }

    pub async fn get_session(&self, id: &str) -> Result<serde_json::Value, Error> {
        self.get(&format!("/api/sessions/{id}")).await
    }

    pub async fn search_sessions(&self, query: &str) -> Result<serde_json::Value, Error> {
        self.get(&format!(
            "/api/sessions/search?q={}",
            urlencoding_encode(query)
        ))
        .await
    }

    pub async fn list_workspaces(&self) -> Result<serde_json::Value, Error> {
        self.get("/api/workspaces").await
    }

    pub async fn get_workspace(&self, id: &str) -> Result<serde_json::Value, Error> {
        self.get(&format!("/api/workspaces/{id}")).await
    }

    pub async fn harvest(&self) -> Result<serde_json::Value, Error> {
        self.post("/api/harvest", serde_json::json!({})).await
    }
}

/// Percent-encode a query value without pulling in another dependency.
fn urlencoding_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.as_bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}
"##;

// ============================================================================
// Java SDK
// ============================================================================

pub const JAVA_SDK_TEMPLATE: &str = r#"// Chasm Java SDK
// Auto-generated - Do not edit directly
// Version: {{version}}
//
// Requires Java 11+ (java.net.http). No external dependencies.

package ai.nervosys.chasm;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

public class Chasm {
    public static final String VERSION = "{{version}}";
    public static final String API_VERSION = "{{api_version}}";

    public static class Config {
        public String baseUrl;
        public String apiKey;
        public Duration timeout = Duration.ofSeconds(30);

        public Config() {
            String env = System.getenv("CHASM_BASE_URL");
            this.baseUrl = (env == null || env.isEmpty()) ? "{{base_url}}" : env;
            this.apiKey = System.getenv("CHASM_API_KEY");
        }
    }

    /** Thrown for any non-2xx response; carries the status so callers can branch. */
    public static class ChasmException extends RuntimeException {
        public final int statusCode;

        public ChasmException(String message, int statusCode) {
            super("chasm: " + message + " (status " + statusCode + ")");
            this.statusCode = statusCode;
        }
    }

    public static class Client {
        private final Config config;
        private final HttpClient http;

        public Client(Config config) {
            this.config = config == null ? new Config() : config;
            this.http = HttpClient.newBuilder().connectTimeout(this.config.timeout).build();
        }

        private String send(HttpRequest.Builder builder) {
            builder.header("Content-Type", "application/json");
            builder.header("User-Agent", "chasm-java/" + VERSION);
            if (config.apiKey != null && !config.apiKey.isEmpty()) {
                builder.header("Authorization", "Bearer " + config.apiKey);
            }
            try {
                HttpResponse<String> resp =
                        http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() >= 400) {
                    throw new ChasmException(resp.body(), resp.statusCode());
                }
                return resp.body();
            } catch (ChasmException e) {
                throw e;
            } catch (Exception e) {
                throw new RuntimeException("chasm: request failed", e);
            }
        }

        private String get(String path) {
            return send(HttpRequest.newBuilder().uri(URI.create(config.baseUrl + path)).GET());
        }

        private String post(String path, String jsonBody) {
            return send(HttpRequest.newBuilder()
                    .uri(URI.create(config.baseUrl + path))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody)));
        }

        public String health() {
            return get("/api/health");
        }

        public String stats() {
            return get("/api/stats");
        }

        public String listSessions() {
            return get("/api/sessions");
        }

        public String getSession(String id) {
            return get("/api/sessions/" + id);
        }

        public String searchSessions(String query) {
            return get("/api/sessions/search?q="
                    + URLEncoder.encode(query, StandardCharsets.UTF_8));
        }

        public String listWorkspaces() {
            return get("/api/workspaces");
        }

        public String getWorkspace(String id) {
            return get("/api/workspaces/" + id);
        }

        public String harvest() {
            return post("/api/harvest", "{}");
        }
    }
}
"#;

// ============================================================================
// C# SDK
// ============================================================================

pub const CSHARP_SDK_TEMPLATE: &str = r#"// Chasm C# SDK
// Auto-generated - Do not edit directly
// Version: {{version}}
//
// Targets .NET 6+. No external dependencies.

using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;

namespace Nervosys.Chasm
{
    public class ChasmConfig
    {
        public string BaseUrl { get; set; }

        /// <summary>Null when unauthenticated, which is a supported state.</summary>
        public string? ApiKey { get; set; }
        public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(30);

        public ChasmConfig()
        {
            var env = Environment.GetEnvironmentVariable("CHASM_BASE_URL");
            BaseUrl = string.IsNullOrEmpty(env) ? "{{base_url}}" : env;
            ApiKey = Environment.GetEnvironmentVariable("CHASM_API_KEY");
        }
    }

    /// <summary>Thrown for any non-2xx response; carries the status code.</summary>
    public class ChasmException : Exception
    {
        public int StatusCode { get; }

        public ChasmException(string message, int statusCode)
            : base($"chasm: {message} (status {statusCode})")
        {
            StatusCode = statusCode;
        }
    }

    public class ChasmClient : IDisposable
    {
        public const string Version = "{{version}}";
        public const string ApiVersion = "{{api_version}}";

        private readonly ChasmConfig _config;
        private readonly HttpClient _http;

        public ChasmClient(ChasmConfig? config = null)
        {
            _config = config ?? new ChasmConfig();
            _http = new HttpClient { Timeout = _config.Timeout };
            _http.DefaultRequestHeaders.UserAgent.ParseAdd($"chasm-csharp/{Version}");
            if (!string.IsNullOrEmpty(_config.ApiKey))
            {
                _http.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", _config.ApiKey);
            }
        }

        private async Task<string> SendAsync(HttpRequestMessage request)
        {
            var response = await _http.SendAsync(request).ConfigureAwait(false);
            var body = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                throw new ChasmException(body, (int)response.StatusCode);
            }
            return body;
        }

        private Task<string> GetAsync(string path) =>
            SendAsync(new HttpRequestMessage(HttpMethod.Get, _config.BaseUrl + path));

        private Task<string> PostAsync(string path, string json) =>
            SendAsync(new HttpRequestMessage(HttpMethod.Post, _config.BaseUrl + path)
            {
                Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json")
            });

        public Task<string> HealthAsync() => GetAsync("/api/health");

        public Task<string> StatsAsync() => GetAsync("/api/stats");

        public Task<string> ListSessionsAsync() => GetAsync("/api/sessions");

        public Task<string> GetSessionAsync(string id) => GetAsync("/api/sessions/" + id);

        public Task<string> SearchSessionsAsync(string query) =>
            GetAsync("/api/sessions/search?q=" + Uri.EscapeDataString(query));

        public Task<string> ListWorkspacesAsync() => GetAsync("/api/workspaces");

        public Task<string> GetWorkspaceAsync(string id) => GetAsync("/api/workspaces/" + id);

        public Task<string> HarvestAsync() => PostAsync("/api/harvest", "{}");

        public void Dispose() => _http.Dispose();
    }
}
"#;

// ============================================================================
// Ruby SDK
// ============================================================================

pub const RUBY_SDK_TEMPLATE: &str = r#"# Chasm Ruby SDK
# Auto-generated - Do not edit directly
# Version: {{version}}
#
# Standard library only.

require 'net/http'
require 'uri'
require 'json'

module Chasm
  VERSION = '{{version}}'.freeze
  API_VERSION = '{{api_version}}'.freeze

  # Raised for any non-2xx response. Carries the status so callers can branch.
  class Error < StandardError
    attr_reader :status_code

    def initialize(message, status_code)
      super("chasm: #{message} (status #{status_code})")
      @status_code = status_code
    end
  end

  class Config
    attr_accessor :base_url, :api_key, :timeout

    def initialize(base_url: nil, api_key: nil, timeout: 30)
      @base_url = base_url || ENV['CHASM_BASE_URL'] || '{{base_url}}'
      @api_key = api_key || ENV['CHASM_API_KEY']
      @timeout = timeout
    end
  end

  class Client
    def initialize(config = nil)
      @config = config || Config.new
    end

    def health
      get('/api/health')
    end

    def stats
      get('/api/stats')
    end

    def list_sessions(limit: nil)
      path = '/api/sessions'
      path += "?limit=#{limit}" if limit
      get(path)
    end

    def get_session(id)
      get("/api/sessions/#{id}")
    end

    def search_sessions(query)
      get("/api/sessions/search?q=#{URI.encode_www_form_component(query)}")
    end

    def list_workspaces
      get('/api/workspaces')
    end

    def get_workspace(id)
      get("/api/workspaces/#{id}")
    end

    def harvest
      post('/api/harvest', {})
    end

    private

    def get(path)
      uri = URI.parse(@config.base_url + path)
      send_request(Net::HTTP::Get.new(uri), uri)
    end

    def post(path, body)
      uri = URI.parse(@config.base_url + path)
      request = Net::HTTP::Post.new(uri)
      request.body = JSON.generate(body)
      send_request(request, uri)
    end

    def send_request(request, uri)
      request['Content-Type'] = 'application/json'
      request['User-Agent'] = "chasm-ruby/#{VERSION}"
      request['Authorization'] = "Bearer #{@config.api_key}" if @config.api_key

      response = Net::HTTP.start(uri.hostname, uri.port,
                                 use_ssl: uri.scheme == 'https',
                                 read_timeout: @config.timeout) do |http|
        http.request(request)
      end

      raise Error.new(response.body, response.code.to_i) if response.code.to_i >= 400

      response.body.empty? ? nil : JSON.parse(response.body)
    end
  end
end
"#;

// ============================================================================
// PHP SDK
// ============================================================================

pub const PHP_SDK_TEMPLATE: &str = r#"<?php
// Chasm PHP SDK
// Auto-generated - Do not edit directly
// Version: {{version}}
//
// Requires PHP 7.4+ with ext-curl and ext-json.

namespace Nervosys\Chasm;

/** Thrown for any non-2xx response; carries the status so callers can branch. */
class ChasmException extends \RuntimeException
{
    public int $statusCode;

    public function __construct(string $message, int $statusCode)
    {
        parent::__construct("chasm: {$message} (status {$statusCode})");
        $this->statusCode = $statusCode;
    }
}

class Config
{
    public string $baseUrl;
    public ?string $apiKey;
    public int $timeout;

    public function __construct(?string $baseUrl = null, ?string $apiKey = null, int $timeout = 30)
    {
        $this->baseUrl = $baseUrl ?: (getenv('CHASM_BASE_URL') ?: '{{base_url}}');
        $this->apiKey = $apiKey ?: (getenv('CHASM_API_KEY') ?: null);
        $this->timeout = $timeout;
    }
}

class Client
{
    public const VERSION = '{{version}}';
    public const API_VERSION = '{{api_version}}';

    private Config $config;

    public function __construct(?Config $config = null)
    {
        $this->config = $config ?? new Config();
    }

    public function health(): array
    {
        return $this->get('/api/health');
    }

    public function stats(): array
    {
        return $this->get('/api/stats');
    }

    public function listSessions(?int $limit = null): array
    {
        $path = '/api/sessions';
        if ($limit !== null) {
            $path .= '?limit=' . $limit;
        }
        return $this->get($path);
    }

    public function getSession(string $id): array
    {
        return $this->get('/api/sessions/' . rawurlencode($id));
    }

    public function searchSessions(string $query): array
    {
        return $this->get('/api/sessions/search?q=' . rawurlencode($query));
    }

    public function listWorkspaces(): array
    {
        return $this->get('/api/workspaces');
    }

    public function getWorkspace(string $id): array
    {
        return $this->get('/api/workspaces/' . rawurlencode($id));
    }

    public function harvest(): array
    {
        return $this->post('/api/harvest', []);
    }

    private function get(string $path): array
    {
        return $this->send('GET', $path, null);
    }

    private function post(string $path, array $body): array
    {
        return $this->send('POST', $path, $body);
    }

    private function send(string $method, string $path, ?array $body): array
    {
        $headers = [
            'Content-Type: application/json',
            'User-Agent: chasm-php/' . self::VERSION,
        ];
        if ($this->config->apiKey) {
            $headers[] = 'Authorization: Bearer ' . $this->config->apiKey;
        }

        $ch = curl_init($this->config->baseUrl . $path);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->config->timeout);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode((object) $body));
        }

        $responseBody = curl_exec($ch);
        if ($responseBody === false) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new \RuntimeException('chasm: request failed: ' . $error);
        }
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status >= 400) {
            throw new ChasmException((string) $responseBody, $status);
        }

        $decoded = json_decode((string) $responseBody, true);
        return is_array($decoded) ? $decoded : [];
    }
}
"#;
// ============================================================================
// SDK Generator
// ============================================================================

/// SDK generator
pub struct SdkGenerator {
    config: SdkConfig,
}

impl SdkGenerator {
    /// Create a new SDK generator
    pub fn new(config: SdkConfig) -> Self {
        Self { config }
    }

    /// Generate SDK for a language
    ///
    /// Matched exhaustively on purpose. The arm here used to be `_ =>
    /// format!("// SDK for {language} not yet implemented")`, which returned a
    /// comment where a caller expected a library: five of the eight languages
    /// silently produced a one-line file. Listing every variant means adding a
    /// language fails to compile until it has a template.
    pub fn generate(&self, language: SdkLanguage) -> String {
        let template = match language {
            SdkLanguage::Python => PYTHON_SDK_TEMPLATE,
            SdkLanguage::NodeJs => NODEJS_SDK_TEMPLATE,
            SdkLanguage::Go => GO_SDK_TEMPLATE,
            SdkLanguage::Rust => RUST_SDK_TEMPLATE,
            SdkLanguage::Java => JAVA_SDK_TEMPLATE,
            SdkLanguage::CSharp => CSHARP_SDK_TEMPLATE,
            SdkLanguage::Ruby => RUBY_SDK_TEMPLATE,
            SdkLanguage::Php => PHP_SDK_TEMPLATE,
        };

        template
            .replace("{{version}}", &self.config.version)
            .replace("{{api_version}}", &self.config.api_version)
            .replace("{{base_url}}", &self.config.base_url)
    }

    /// Generate all SDKs
    pub fn generate_all(&self) -> HashMap<SdkLanguage, String> {
        self.config
            .languages
            .iter()
            .map(|lang| (lang.clone(), self.generate(lang.clone())))
            .collect()
    }

    /// Get SDK file name for language
    pub fn get_filename(&self, language: &SdkLanguage) -> String {
        match language {
            SdkLanguage::Python => "chasm.py".to_string(),
            SdkLanguage::NodeJs => "chasm.js".to_string(),
            SdkLanguage::Go => "chasm.go".to_string(),
            SdkLanguage::Rust => "chasm.rs".to_string(),
            SdkLanguage::Java => "Chasm.java".to_string(),
            SdkLanguage::CSharp => "Chasm.cs".to_string(),
            SdkLanguage::Ruby => "chasm.rb".to_string(),
            SdkLanguage::Php => "Chasm.php".to_string(),
        }
    }
}

impl Default for SdkConfig {
    fn default() -> Self {
        Self {
            version: "1.0.0".to_string(),
            base_url: "http://localhost:8787".to_string(),
            languages: SdkLanguage::ALL.to_vec(),
            api_version: "v1".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sdk_generation() {
        let config = SdkConfig::default();
        let generator = SdkGenerator::new(config);

        let python_sdk = generator.generate(SdkLanguage::Python);
        assert!(python_sdk.contains("class ChasmClient"));
        assert!(python_sdk.contains("1.0.0"));

        let nodejs_sdk = generator.generate(SdkLanguage::NodeJs);
        assert!(nodejs_sdk.contains("class ChasmClient"));

        let go_sdk = generator.generate(SdkLanguage::Go);
        assert!(go_sdk.contains("type Client struct"));
    }

    fn generated(language: SdkLanguage) -> String {
        SdkGenerator::new(SdkConfig::default()).generate(language)
    }

    /// Five of the eight languages used to return
    /// `// SDK for rust not yet implemented` -- a *string*, not an error, so a
    /// caller wrote a one-line file and found out later.
    #[test]
    fn every_language_generates_a_real_sdk() {
        for language in SdkLanguage::ALL {
            let sdk = generated(language.clone());
            assert!(
                !sdk.contains("not yet implemented"),
                "{language} still returns a placeholder"
            );
            assert!(
                sdk.len() > 500,
                "{language} produced {} bytes, which is not a library",
                sdk.len()
            );
        }
    }

    /// An unsubstituted `{{version}}` would ship into generated source, where
    /// it is a syntax error in some of these languages and a wrong value in
    /// the rest.
    #[test]
    fn no_placeholder_survives_generation() {
        for language in SdkLanguage::ALL {
            let sdk = generated(language.clone());
            assert!(
                !sdk.contains("{{"),
                "{language} left an unsubstituted placeholder"
            );
            assert!(
                sdk.contains("1.0.0"),
                "{language} did not get the version substituted"
            );
        }
    }

    /// Every SDK must reach the API the same way, or a client library becomes
    /// a per-language guess about what the server exposes.
    #[test]
    fn every_sdk_talks_to_the_same_api_surface() {
        for language in SdkLanguage::ALL {
            let sdk = generated(language.clone());
            for path in [
                "/api/health",
                "/api/stats",
                "/api/sessions",
                "/api/workspaces",
            ] {
                assert!(sdk.contains(path), "{language} never calls {path}");
            }
            assert!(
                sdk.contains("CHASM_BASE_URL") && sdk.contains("CHASM_API_KEY"),
                "{language} ignores the environment configuration the others honour"
            );
        }
    }

    /// The paths the SDKs call must be paths the server routes.
    ///
    /// This is not hypothetical: every SDK called `/health`, which 404s -- the
    /// route is inside the `/api` scope -- and `/api/harvest/status`, which
    /// does not exist at all. Both shipped. Checking against `openapi.yaml`,
    /// which its own tests hold to the running server, stops that recurring.
    #[test]
    fn sdk_paths_exist_in_the_openapi_spec() {
        let spec: serde_json::Value =
            serde_yaml::from_str(include_str!("../../openapi.yaml")).expect("spec parses");
        let paths = spec["paths"].as_object().expect("spec has paths");

        // Spec paths are relative to a `/api` server base unless the operation
        // overrides it, so compare on the `/api`-prefixed form.
        let documented: std::collections::HashSet<String> =
            paths.keys().map(|p| format!("/api{p}")).collect();

        let re = regex::Regex::new(r#"/api/[a-z0-9/_-]+"#).expect("regex");
        for language in SdkLanguage::ALL {
            let sdk = generated(language.clone());
            for m in re.find_iter(&sdk) {
                let called = m.as_str().trim_end_matches('/');
                // Ignore prefixes that are built up before an id is appended.
                if called.ends_with("/sessions") || called.ends_with("/workspaces") {
                    // still a real path; fall through to the check
                }
                assert!(
                    documented.contains(called),
                    "{language} calls {called}, which openapi.yaml does not document"
                );
            }
        }
    }
}
