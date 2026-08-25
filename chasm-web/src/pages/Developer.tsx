// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { useState, useMemo, useEffect } from 'react';
import {
    Download,
    Database,
    Cpu,
    Zap,
    Layers,
    Minimize2,
    Scissors,
    Rocket,
    Search,
    Filter,
    Play,
    Pause,
    CheckCircle2,
    Clock,
    AlertCircle,
    ChevronRight,
    ExternalLink,
    HardDrive,
    Microchip,
    Server,
    Smartphone,
    Settings,
    TrendingDown,
    Package,
    GitBranch,
    RefreshCw,
    Plus,
    FileDown,
    Box,
    Loader2,
    BookOpen,
    Wrench,
    Image,
    FileText,
    Music,
    Video,
    Link,
    Upload,
    Eye,
    Terminal,
    Trash2,
    FileCode,
    Sparkles,
    Camera,
    Cog,
    Mountain,
    Car,
    Plane,
    Factory,
    Building2,
    Gamepad2,
    Bot,
    Compass,
    Hand,
    Radar,
    Activity,
    Cloud,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
    useProviders,
    useProviderHealth,
    useMcpTools,
    useCallMcpTool,
    useDocuments,
    useIngestDocument,
    useSearchDocuments,
    useDeleteDocument,
} from '../hooks/useApi';
import type { DocumentSearchResults } from '../api/client';
import { ExampleDataBanner } from '../components/ExampleDataBanner';

/*
 * Everything below this line is built into the bundle.
 *
 * There is no backend for any of it: the server routes no /datasets,
 * /training, /rag, /simulation or /robotics path, so the training jobs shown
 * running at 67% on an RTX 4090, the vector databases reporting 2.4M vectors
 * and the RAG pipelines with query counts describe nothing that exists. Of the
 * 49 buttons on this page, three have a handler.
 *
 * The page now says so in a banner rather than presenting all of it as the
 * reader's own infrastructure. Wiring a section means building its endpoints
 * first; delete the banner in the same change that does.
 */
const pretrainedModels = [
    { id: 'llama-3.2-3b', name: 'Llama 3.2 3B', provider: 'Meta', size: '6.4 GB', params: '3B', format: 'GGUF', downloaded: true, tasks: ['text-generation', 'chat'] },
    { id: 'llama-3.2-1b', name: 'Llama 3.2 1B', provider: 'Meta', size: '2.3 GB', params: '1B', format: 'GGUF', downloaded: true, tasks: ['text-generation', 'chat'] },
    { id: 'phi-3-mini', name: 'Phi-3 Mini', provider: 'Microsoft', size: '2.4 GB', params: '3.8B', format: 'GGUF', downloaded: false, tasks: ['text-generation', 'reasoning'] },
    { id: 'qwen2.5-3b', name: 'Qwen 2.5 3B', provider: 'Alibaba', size: '6.1 GB', params: '3B', format: 'GGUF', downloaded: false, tasks: ['text-generation', 'code'] },
    { id: 'gemma-2-2b', name: 'Gemma 2 2B', provider: 'Google', size: '5.0 GB', params: '2B', format: 'GGUF', downloaded: true, tasks: ['text-generation', 'chat'] },
    { id: 'mistral-7b', name: 'Mistral 7B', provider: 'Mistral AI', size: '4.1 GB', params: '7B', format: 'GGUF', downloaded: false, tasks: ['text-generation', 'instruct'] },
    { id: 'deepseek-r1-7b', name: 'DeepSeek R1 7B', provider: 'DeepSeek', size: '4.7 GB', params: '7B', format: 'GGUF', downloaded: false, tasks: ['reasoning', 'code'] },
    { id: 'codellama-7b', name: 'Code Llama 7B', provider: 'Meta', size: '3.8 GB', params: '7B', format: 'GGUF', downloaded: true, tasks: ['code-generation', 'code-completion'] },
];

const datasets = [
    { id: 'openorca', name: 'OpenOrca', source: 'HuggingFace', size: '12.5 GB', samples: '4.2M', format: 'Parquet', downloaded: false, tasks: ['instruction-tuning'] },
    { id: 'slimorca', name: 'SlimOrca', source: 'HuggingFace', size: '1.8 GB', samples: '518K', format: 'JSON', downloaded: true, tasks: ['instruction-tuning'] },
    { id: 'dolly-15k', name: 'Dolly 15K', source: 'Databricks', size: '45 MB', samples: '15K', format: 'JSON', downloaded: true, tasks: ['instruction-tuning'] },
    { id: 'code-alpaca', name: 'Code Alpaca', source: 'HuggingFace', size: '28 MB', samples: '20K', format: 'JSON', downloaded: false, tasks: ['code-generation'] },
    { id: 'gsm8k', name: 'GSM8K', source: 'OpenAI', size: '12 MB', samples: '8.5K', format: 'JSON', downloaded: true, tasks: ['math-reasoning'] },
    { id: 'squad-v2', name: 'SQuAD v2.0', source: 'Stanford', size: '44 MB', samples: '150K', format: 'JSON', downloaded: false, tasks: ['question-answering'] },
];

const trainingJobs = [
    { id: 'job-001', name: 'Llama 3.2 Fine-tune', model: 'llama-3.2-3b', type: 'fine-tune', status: 'running', progress: 67, eta: '2h 15m', gpu: 'RTX 4090' },
    { id: 'job-002', name: 'Code Assistant LoRA', model: 'codellama-7b', type: 'lora', status: 'running', progress: 34, eta: '4h 30m', gpu: 'RTX 4090' },
    { id: 'job-003', name: 'Phi-3 Distillation', model: 'phi-3-mini', type: 'distillation', status: 'queued', progress: 0, eta: '--', gpu: 'Pending' },
    { id: 'job-004', name: 'Gemma Quantization', model: 'gemma-2-2b', type: 'quantization', status: 'completed', progress: 100, eta: '--', gpu: 'RTX 4090' },
];

const deploymentTargets = [
    { id: 'mcu', name: 'MCU', icon: Microchip, description: 'ARM Cortex-M, ESP32, STM32', formats: ['TFLite Micro', 'ONNX Micro'], color: '#f59e0b' },
    { id: 'cpu', name: 'CPU', icon: Cpu, description: 'x86, ARM, RISC-V', formats: ['GGUF', 'ONNX', 'OpenVINO'], color: '#3b82f6' },
    { id: 'gpu', name: 'GPU', icon: Server, description: 'NVIDIA CUDA, AMD ROCm', formats: ['GGUF', 'TensorRT', 'ONNX'], color: '#10b981' },
    { id: 'npu', name: 'NPU', icon: Zap, description: 'Apple ANE, Qualcomm Hexagon', formats: ['Core ML', 'QNN', 'ONNX'], color: '#8b5cf6' },
    { id: 'edge', name: 'Edge', icon: Smartphone, description: 'Jetson, Raspberry Pi, Mobile', formats: ['TFLite', 'ONNX', 'MLC'], color: '#ec4899' },
];

const compressionMethods = [
    { id: 'quant-int8', name: 'INT8 Quantization', reduction: '75%', speedup: '2-4x', quality: '< 1% loss', supported: ['CPU', 'GPU', 'NPU'] },
    { id: 'quant-int4', name: 'INT4 Quantization', reduction: '87.5%', speedup: '3-6x', quality: '1-3% loss', supported: ['CPU', 'GPU'] },
    { id: 'pruning-struct', name: 'Structured Pruning', reduction: '50-90%', speedup: '2-5x', quality: '1-5% loss', supported: ['CPU', 'GPU', 'NPU'] },
    { id: 'pruning-unstruct', name: 'Unstructured Pruning', reduction: '70-95%', speedup: '1-2x', quality: '2-5% loss', supported: ['CPU'] },
    { id: 'distillation', name: 'Knowledge Distillation', reduction: '60-90%', speedup: '3-10x', quality: '2-5% loss', supported: ['All'] },
    { id: 'low-rank', name: 'Low-Rank Factorization', reduction: '30-60%', speedup: '1.5-3x', quality: '< 2% loss', supported: ['CPU', 'GPU'] },
];

const trainingMetrics = [
    { epoch: 1, loss: 2.4, val_loss: 2.5, lr: 0.0001 },
    { epoch: 2, loss: 1.8, val_loss: 1.9, lr: 0.0001 },
    { epoch: 3, loss: 1.4, val_loss: 1.5, lr: 0.00008 },
    { epoch: 4, loss: 1.1, val_loss: 1.2, lr: 0.00006 },
    { epoch: 5, loss: 0.9, val_loss: 1.0, lr: 0.00004 },
    { epoch: 6, loss: 0.7, val_loss: 0.85, lr: 0.00002 },
];

// RAG data is served, not declared here.
//
// Five vector databases holding 9.5M vectors, eight embedding models and
// three RAG pipelines with query counts used to sit in this spot, on an
// install that had never indexed anything. The knowledge base is one store
// behind `/api/documents`, and the RAG tab reads it.

// Function Calling / Tool Use
//
// The tool list is served, not declared here. What used to sit in this spot
// was a fixture of six tools -- `web_search`, `calculate`, an image generator
// -- none of which Chasm has, each with an invented monthly call count. The
// server exposes 16 real ones over `/api/mcp/tools`, with real JSON Schema,
// and `/api/mcp/call` runs them.

/**
 * The schema formats the server actually hands over.
 *
 * Both are served verbatim by `/api/mcp/tools`: it returns each tool twice,
 * once as an OpenAI function definition and once in MCP form. Anthropic and
 * Gemini were listed here too, but nothing in this repo produces or checks
 * either encoding, so offering them would be claiming a conversion that does
 * not exist.
 */
const toolSchemas = {
    openai: 'OpenAI Function Calling',
    mcp: 'Model Context Protocol',
};

/**
 * The chunking strategies `/api/documents` accepts.
 *
 * Names match the server's `parse_strategy` exactly; anything else is a 400.
 */
const CHUNKING_STRATEGIES = [
    { value: 'semantic', label: 'Semantic (respects structure)' },
    { value: 'paragraph', label: 'Paragraph' },
    { value: 'sentence', label: 'Sentence' },
    { value: 'fixed_size', label: 'Fixed size' },
    { value: 'code', label: 'Code-aware' },
];

/** One row of the parameter table, flattened out of a tool's JSON Schema. */
interface ToolParam {
    name: string;
    type: string;
    required: boolean;
    description: string;
}

/**
 * Read a tool's parameters off its `inputSchema`.
 *
 * Returns nothing rather than guessing when the schema has no `properties` --
 * several of these tools genuinely take no arguments, and an empty list is the
 * right answer for them.
 */
function toolParams(inputSchema: Record<string, unknown> | undefined): ToolParam[] {
    const properties = inputSchema?.properties;
    if (!properties || typeof properties !== 'object') return [];

    const required = Array.isArray(inputSchema?.required)
        ? (inputSchema.required as unknown[]).filter((r): r is string => typeof r === 'string')
        : [];

    return Object.entries(properties as Record<string, unknown>).map(([name, raw]) => {
        const field = (raw ?? {}) as Record<string, unknown>;
        return {
            name,
            type: typeof field.type === 'string' ? field.type : 'unknown',
            required: required.includes(name),
            description: typeof field.description === 'string' ? field.description : '',
        };
    });
}


// Multi-Modal Models Data
const multiModalModels = [
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'OpenAI',
        modalities: ['text', 'image', 'audio'],
        inputTypes: ['Text', 'Images', 'Audio'],
        outputTypes: ['Text', 'Audio'],
        maxTokens: 128000,
        status: 'available',
        pricing: '$5.00/1M input, $15.00/1M output',
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'OpenAI',
        modalities: ['text', 'image'],
        inputTypes: ['Text', 'Images'],
        outputTypes: ['Text'],
        maxTokens: 128000,
        status: 'available',
        pricing: '$0.15/1M input, $0.60/1M output',
    },
    {
        id: 'claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'Anthropic',
        modalities: ['text', 'image'],
        inputTypes: ['Text', 'Images', 'PDFs'],
        outputTypes: ['Text'],
        maxTokens: 200000,
        status: 'available',
        pricing: '$3.00/1M input, $15.00/1M output',
    },
    {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'Google',
        modalities: ['text', 'image', 'audio', 'video'],
        inputTypes: ['Text', 'Images', 'Audio', 'Video'],
        outputTypes: ['Text'],
        maxTokens: 2000000,
        status: 'available',
        pricing: '$1.25/1M input, $5.00/1M output',
    },
    {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'Google',
        modalities: ['text', 'image', 'audio', 'video'],
        inputTypes: ['Text', 'Images', 'Audio', 'Video'],
        outputTypes: ['Text', 'Images', 'Audio'],
        maxTokens: 1000000,
        status: 'available',
        pricing: '$0.075/1M input, $0.30/1M output',
    },
    {
        id: 'llava-1.6',
        name: 'LLaVA 1.6',
        provider: 'Open Source',
        modalities: ['text', 'image'],
        inputTypes: ['Text', 'Images'],
        outputTypes: ['Text'],
        maxTokens: 4096,
        status: 'local',
        pricing: 'Free (Local)',
    },
    {
        id: 'qwen2-vl',
        name: 'Qwen2-VL',
        provider: 'Alibaba',
        modalities: ['text', 'image', 'video'],
        inputTypes: ['Text', 'Images', 'Video'],
        outputTypes: ['Text'],
        maxTokens: 32768,
        status: 'local',
        pricing: 'Free (Local)',
    },
    {
        id: 'pixtral',
        name: 'Pixtral 12B',
        provider: 'Mistral',
        modalities: ['text', 'image'],
        inputTypes: ['Text', 'Images'],
        outputTypes: ['Text'],
        maxTokens: 128000,
        status: 'available',
        pricing: '$0.15/1M input, $0.15/1M output',
    },
];

const modalityIcons: Record<string, typeof Image> = {
    text: FileText,
    image: Image,
    audio: Music,
    video: Video,
};

// Photorealistic Simulators for Synthetic Data Generation
const simulators = [
    {
        id: 'unreal-engine',
        name: 'Unreal Engine 5',
        provider: 'Epic Games',
        category: 'Game Engine',
        icon: Gamepad2,
        description: 'Industry-leading real-time 3D creation with Nanite, Lumen, and MetaHumans',
        features: ['Nanite virtualized geometry', 'Lumen global illumination', 'MetaHumans', 'Chaos physics'],
        dataTypes: ['RGB images', 'Depth maps', 'Semantic segmentation', 'Instance segmentation', 'Optical flow'],
        domains: ['Autonomous vehicles', 'Robotics', 'VR/AR', 'Film production'],
        status: 'connected',
        apiEndpoint: 'localhost:8080',
    },
    {
        id: 'nvidia-omniverse',
        name: 'NVIDIA Omniverse',
        provider: 'NVIDIA',
        category: 'Simulation Platform',
        icon: Cog,
        description: 'USD-based platform for building and operating metaverse applications',
        features: ['RTX ray tracing', 'PhysX 5', 'USD scene composition', 'Replicator synthetic data'],
        dataTypes: ['RGB images', 'Depth', 'Normals', 'Bounding boxes', 'Point clouds', 'LiDAR'],
        domains: ['Robotics', 'Digital twins', 'Autonomous systems', 'Manufacturing'],
        status: 'connected',
        apiEndpoint: 'localhost:8211',
    },
    {
        id: 'carla',
        name: 'CARLA Simulator',
        provider: 'Open Source',
        category: 'Driving Simulator',
        icon: Car,
        description: 'Open-source simulator for autonomous driving research',
        features: ['Dynamic weather', 'Traffic simulation', 'Sensor suite', 'ROS integration'],
        dataTypes: ['Camera RGB', 'Depth', 'Semantic segmentation', 'LiDAR point clouds', 'Radar', 'IMU'],
        domains: ['Autonomous driving', 'ADAS', 'Traffic research'],
        status: 'disconnected',
        apiEndpoint: 'localhost:2000',
    },
    {
        id: 'airsim',
        name: 'AirSim',
        provider: 'Microsoft',
        category: 'Drone/Vehicle Simulator',
        icon: Plane,
        description: 'Open-source simulator for drones and autonomous vehicles built on UE4',
        features: ['Multi-vehicle support', 'PX4/ArduPilot integration', 'Weather effects', 'Physics engine'],
        dataTypes: ['RGB images', 'Depth', 'Segmentation', 'Surface normals', 'Object detection labels'],
        domains: ['Aerial robotics', 'Drones', 'Autonomous vehicles'],
        status: 'disconnected',
        apiEndpoint: 'localhost:41451',
    },
    {
        id: 'isaac-sim',
        name: 'NVIDIA Isaac Sim',
        provider: 'NVIDIA',
        category: 'Robotics Simulator',
        icon: Factory,
        description: 'Scalable robotics simulation for AI training and synthetic data generation',
        features: ['ROS/ROS2 integration', 'Domain randomization', 'Synthetic data pipeline', 'Digital twins'],
        dataTypes: ['RGB', 'Depth', 'Semantic/Instance segmentation', 'Bounding boxes', '6-DoF poses'],
        domains: ['Industrial robotics', 'Warehouse automation', 'Manipulation', 'Navigation'],
        status: 'connected',
        apiEndpoint: 'localhost:8899',
    },
    {
        id: 'habitat',
        name: 'Habitat-Sim',
        provider: 'Meta AI',
        category: 'Embodied AI',
        icon: Building2,
        description: 'High-performance 3D simulator for embodied AI research',
        features: ['10,000+ FPS rendering', 'Matterport3D scenes', 'Gibson environments', 'ReplicaCAD'],
        dataTypes: ['RGB', 'Depth', 'Semantic segmentation', 'Top-down maps', 'Agent trajectories'],
        domains: ['Indoor navigation', 'Embodied QA', 'Rearrangement', 'Social navigation'],
        status: 'disconnected',
        apiEndpoint: 'localhost:5000',
    },
    {
        id: 'blender',
        name: 'Blender + BlenderProc',
        provider: 'Open Source',
        category: '3D Rendering',
        icon: Mountain,
        description: 'Procedural synthetic data generation with photorealistic Cycles rendering',
        features: ['Cycles path tracing', 'Geometry nodes', 'Physics simulation', 'Python scripting'],
        dataTypes: ['RGB', 'Depth', 'Normals', 'Segmentation', 'Optical flow', 'COCO annotations'],
        domains: ['Object detection', '6-DoF pose estimation', 'Indoor scenes', 'Product visualization'],
        status: 'connected',
        apiEndpoint: 'localhost:9000',
    },
    {
        id: 'gazebo',
        name: 'Gazebo Ignition',
        provider: 'Open Robotics',
        category: 'Robotics Simulator',
        icon: Cog,
        description: 'Open-source robotics simulator with accurate physics and sensor models',
        features: ['ODE/Bullet/DART physics', 'ROS integration', 'SDF models', 'Plugin architecture'],
        dataTypes: ['Camera images', 'Depth', 'LiDAR', 'IMU', 'GPS', 'Force/torque sensors'],
        domains: ['Mobile robots', 'Manipulators', 'Multi-robot systems', 'Field robotics'],
        status: 'disconnected',
        apiEndpoint: 'localhost:11345',
    },
];

const syntheticDataJobs = [
    { id: 'job-s1', name: 'Urban Driving Scenes', simulator: 'CARLA', scenes: 10000, status: 'running', progress: 45, outputSize: '124 GB' },
    { id: 'job-s2', name: 'Warehouse Pick & Place', simulator: 'Isaac Sim', scenes: 50000, status: 'running', progress: 78, outputSize: '89 GB' },
    { id: 'job-s3', name: 'Indoor Navigation', simulator: 'Habitat-Sim', scenes: 25000, status: 'queued', progress: 0, outputSize: '-- GB' },
    { id: 'job-s4', name: 'Object Detection 6-DoF', simulator: 'BlenderProc', scenes: 100000, status: 'completed', progress: 100, outputSize: '256 GB' },
];

const dataAugmentations = [
    { id: 'lighting', name: 'Lighting Variations', description: 'HDR environment maps, time of day, shadows' },
    { id: 'weather', name: 'Weather Effects', description: 'Rain, fog, snow, dust particles' },
    { id: 'camera', name: 'Camera Intrinsics', description: 'Focal length, distortion, motion blur' },
    { id: 'materials', name: 'Material Randomization', description: 'Textures, reflectance, roughness' },
    { id: 'occlusion', name: 'Occlusion & Clutter', description: 'Distractors, partial visibility' },
    { id: 'pose', name: 'Pose Variations', description: '6-DoF object and camera poses' },
];

// Robotics Data
const roboticsPlatforms = [
    {
        id: 'ros2',
        name: 'ROS 2 Humble',
        type: 'Middleware',
        status: 'connected',
        description: 'Robot Operating System 2 - Industry standard robotics middleware',
        features: ['DDS communication', 'Lifecycle nodes', 'QoS policies', 'Real-time support'],
        nodes: 24,
        topics: 156,
        services: 42,
    },
    {
        id: 'moveit2',
        name: 'MoveIt 2',
        type: 'Motion Planning',
        status: 'connected',
        description: 'Motion planning framework for manipulation',
        features: ['OMPL planners', 'Collision detection', 'Kinematics', 'Trajectory execution'],
        nodes: 8,
        topics: 45,
        services: 18,
    },
    {
        id: 'nav2',
        name: 'Nav2',
        type: 'Navigation',
        status: 'connected',
        description: 'Navigation stack for autonomous mobile robots',
        features: ['Path planning', 'Behavior trees', 'Costmaps', 'Recovery behaviors'],
        nodes: 12,
        topics: 78,
        services: 24,
    },
    {
        id: 'micro-ros',
        name: 'micro-ROS',
        type: 'Embedded',
        status: 'disconnected',
        description: 'ROS 2 for microcontrollers (ARM Cortex-M, ESP32)',
        features: ['RTOS integration', 'DDS-XRCE', 'Memory efficient', 'Real-time'],
        nodes: 0,
        topics: 0,
        services: 0,
    },
];

const robotHardware = [
    { id: 'ur5e', name: 'Universal Robots UR5e', type: 'Manipulator', dof: 6, payload: '5 kg', reach: '850 mm', status: 'connected' },
    { id: 'franka', name: 'Franka Emika Panda', type: 'Manipulator', dof: 7, payload: '3 kg', reach: '855 mm', status: 'disconnected' },
    { id: 'turtlebot4', name: 'TurtleBot 4', type: 'Mobile Base', dof: 2, payload: '9 kg', reach: 'N/A', status: 'connected' },
    { id: 'spot', name: 'Boston Dynamics Spot', type: 'Quadruped', dof: 12, payload: '14 kg', reach: 'N/A', status: 'disconnected' },
    { id: 'sawyer', name: 'Rethink Sawyer', type: 'Manipulator', dof: 7, payload: '4 kg', reach: '1260 mm', status: 'disconnected' },
    { id: 'husky', name: 'Clearpath Husky', type: 'Mobile Base', dof: 4, payload: '75 kg', reach: 'N/A', status: 'connected' },
];

const robotSensors = [
    { id: 'realsense-d455', name: 'Intel RealSense D455', type: 'RGB-D Camera', interface: 'USB 3.0', fps: 90, status: 'active' },
    { id: 'velodyne-vlp16', name: 'Velodyne VLP-16', type: 'LiDAR', interface: 'Ethernet', fps: 20, status: 'active' },
    { id: 'robotiq-ft300', name: 'Robotiq FT 300', type: 'Force/Torque', interface: 'USB', fps: 100, status: 'active' },
    { id: 'imu-bno085', name: 'BNO085 IMU', type: 'IMU', interface: 'I2C', fps: 400, status: 'active' },
    { id: 'ouster-os1', name: 'Ouster OS1-64', type: 'LiDAR', interface: 'Ethernet', fps: 20, status: 'inactive' },
    { id: 'zed2i', name: 'Stereolabs ZED 2i', type: 'Stereo Camera', interface: 'USB 3.0', fps: 100, status: 'active' },
];

const robotTasks = [
    { id: 'pick-place', name: 'Pick & Place', robot: 'UR5e', status: 'running', success: 94, attempts: 156, avgTime: '4.2s' },
    { id: 'navigation', name: 'Warehouse Navigation', robot: 'Husky', status: 'running', success: 98, attempts: 89, avgTime: '45s' },
    { id: 'inspection', name: 'Visual Inspection', robot: 'TurtleBot 4', status: 'paused', success: 87, attempts: 234, avgTime: '12s' },
    { id: 'assembly', name: 'Assembly Task', robot: 'UR5e', status: 'completed', success: 91, attempts: 500, avgTime: '8.5s' },
];

type Tab = 'models' | 'datasets' | 'training' | 'optimization' | 'deployment' | 'rag' | 'tools' | 'multimodal' | 'simulation' | 'robotics';

/** Tabs that read from the server rather than from a fixture. */
const SERVED_TABS = new Set<Tab>(['tools', 'rag']);


export default function Developer() {
    // API Data - Connected providers for inference
    const { data: connectedProviders } = useProviders();
    const { data: providerHealth } = useProviderHealth();

    // The Tool Use tab's tools are the server's, from `/api/mcp/tools`.
    const { data: mcpData, isLoading: toolsLoading, error: toolsError } = useMcpTools();
    const tools = useMemo(() => mcpData?.mcp_tools ?? [], [mcpData]);

    const [activeTab, setActiveTab] = useState<Tab>('models');
    const [modelSearch, setModelSearch] = useState('');
    const [datasetSearch, setDatasetSearch] = useState('');

    // Tool testing
    const callTool = useCallMcpTool();
    const [testToolName, setTestToolName] = useState('');
    const [testInput, setTestInput] = useState('{}');
    const [testOutput, setTestOutput] = useState<{ text: string; isError: boolean } | null>(null);

    // Knowledge base, served by /api/documents.
    const {
        data: documentsData,
        isLoading: documentsLoading,
        error: documentsError,
        refetch: refetchDocuments,
    } = useDocuments();
    const docs = useMemo(() => documentsData ?? [], [documentsData]);

    const ingestDocument = useIngestDocument();
    const [ingestTitle, setIngestTitle] = useState('');
    const [ingestContent, setIngestContent] = useState('');
    const [ingestStrategy, setIngestStrategy] = useState('semantic');
    const [ingestMessage, setIngestMessage] = useState<{ text: string; isError: boolean } | null>(null);

    const searchDocuments = useSearchDocuments();
    const deleteDocument = useDeleteDocument();
    const [ragQuery, setRagQuery] = useState('');
    const [ragResults, setRagResults] = useState<DocumentSearchResults | null>(null);
    const [ragError, setRagError] = useState<string | null>(null);

    /**
     * Ingest, then re-read the list.
     *
     * The chunk count comes back from the server rather than being guessed
     * here -- how a document splits depends on the strategy and on the text,
     * and this side does neither.
     */
    const handleIngest = async () => {
        setIngestMessage(null);
        try {
            const summary = await ingestDocument.mutate({
                title: ingestTitle,
                content: ingestContent,
                strategy: ingestStrategy,
            });
            setIngestMessage(
                summary
                    ? {
                          text: `Ingested as ${summary.chunkCount} chunk${summary.chunkCount === 1 ? '' : 's'}.`,
                          isError: false,
                      }
                    // A resolved call with no payload is not a success worth
                    // reporting as one: the document's fate is unknown here.
                    : { text: 'The server returned no result for the ingest.', isError: true }
            );
            setIngestTitle('');
            setIngestContent('');
            await refetchDocuments();
        } catch (err) {
            setIngestMessage({
                text: err instanceof Error ? err.message : 'The server rejected the document.',
                isError: true,
            });
        }
    };

    const handleRagSearch = async () => {
        if (!ragQuery.trim()) return;
        setRagError(null);
        setRagResults(null);
        try {
            setRagResults(await searchDocuments.mutate({ q: ragQuery }));
        } catch (err) {
            setRagError(err instanceof Error ? err.message : 'The search failed.');
        }
    };

    const handleDeleteDocument = async (id: string) => {
        try {
            await deleteDocument.mutate(id);
            // Results can reference the document that just went away.
            setRagResults(null);
            await refetchDocuments();
        } catch (err) {
            setRagError(err instanceof Error ? err.message : 'The document could not be deleted.');
        }
    };

    // Schema export
    const [schemaFormat, setSchemaFormat] = useState<keyof typeof toolSchemas>('openai');
    const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
    const [generatedSchema, setGeneratedSchema] = useState<string | null>(null);

    // Default the selection to everything, once the list arrives.
    useEffect(() => {
        setSelectedTools(new Set(tools.map(t => t.name)));
    }, [tools]);

    // Default the test target to the first tool, once the list arrives.
    useEffect(() => {
        setTestToolName(current => current || (tools[0]?.name ?? ''));
    }, [tools]);

    /**
     * Run the selected tool against the server.
     *
     * Both failure modes are the user's to see: input that is not JSON never
     * reaches the server, and a tool that ran and failed comes back 200 with
     * `isError` set. Reporting only thrown errors would render the second as a
     * successful run.
     */
    const handleExecuteTool = async () => {
        let args: Record<string, unknown>;
        try {
            const parsed = JSON.parse(testInput || '{}');
            if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('Arguments must be a JSON object.');
            }
            args = parsed as Record<string, unknown>;
        } catch (err) {
            setTestOutput({
                text: err instanceof Error ? err.message : 'Input is not valid JSON.',
                isError: true,
            });
            return;
        }

        try {
            const result = await callTool.mutate({ name: testToolName, args });
            const text = (result?.result?.content ?? [])
                .map(part => part.text)
                .join('\n')
                .trim();
            setTestOutput({
                text: text || '(the tool returned no content)',
                isError: result?.result?.isError === true,
            });
        } catch (err) {
            setTestOutput({
                text: err instanceof Error ? err.message : 'The server rejected the call.',
                isError: true,
            });
        }
    };

    /**
     * Render the checked tools in the chosen format.
     *
     * Both formats come off the wire rather than being converted here: the
     * server sends every tool as an OpenAI function definition and as an MCP
     * definition in the same response.
     */
    const handleGenerateSchema = () => {
        const chosen = tools.filter(t => selectedTools.has(t.name));
        const payload =
            schemaFormat === 'openai'
                ? chosen.map(t => ({
                      type: 'function',
                      function: {
                          name: t.name,
                          description: t.description,
                          parameters: t.inputSchema,
                      },
                  }))
                : chosen;
        setGeneratedSchema(JSON.stringify(payload, null, 2));
    };

    // Get provider health status
    const getProviderStatus = useMemo(() => {
        const status: Record<string, 'connected' | 'disconnected' | 'error'> = {};
        if (providerHealth) {
            providerHealth.forEach(h => {
                status[h.providerId] = h.status === 'connected' ? 'connected' :
                    h.status === 'error' ? 'error' : 'disconnected';
            });
        }
        return status;
    }, [providerHealth]);

    // Connected inference endpoints
    const inferenceEndpoints = useMemo(() => {
        if (!connectedProviders) return [];
        return connectedProviders.map(p => ({
            id: p.id,
            name: p.name,
            type: p.type || 'cloud',
            models: p.models || [],
            status: getProviderStatus[p.id] || 'unknown',
            endpoint: p.endpoint,
        }));
    }, [connectedProviders, getProviderStatus]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'running': return <Loader2 size={16} className="animate-spin text-blue-500" />;
            case 'queued': return <Clock size={16} className="text-yellow-500" />;
            case 'completed': return <CheckCircle2 size={16} className="text-green-500" />;
            case 'failed': return <AlertCircle size={16} className="text-red-500" />;
            default: return null;
        }
    };

    const filteredModels = pretrainedModels.filter(m =>
        m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
        m.provider.toLowerCase().includes(modelSearch.toLowerCase())
    );

    const filteredDatasets = datasets.filter(d =>
        d.name.toLowerCase().includes(datasetSearch.toLowerCase()) ||
        d.source.toLowerCase().includes(datasetSearch.toLowerCase())
    );

    const tabs = [
        { id: 'models' as Tab, label: 'Models', icon: Box },
        { id: 'datasets' as Tab, label: 'Datasets', icon: Database },
        { id: 'simulation' as Tab, label: 'Simulation', icon: Camera },
        { id: 'training' as Tab, label: 'Training', icon: Zap },
        { id: 'optimization' as Tab, label: 'Optimization', icon: TrendingDown },
        { id: 'deployment' as Tab, label: 'Deployment', icon: Rocket },
        { id: 'rag' as Tab, label: 'RAG', icon: BookOpen },
        { id: 'tools' as Tab, label: 'Tool Use', icon: Wrench },
        { id: 'multimodal' as Tab, label: 'Multi-Modal', icon: Sparkles },
        { id: 'robotics' as Tab, label: 'Robotics', icon: Bot },
    ];

    return (
        <div className="space-y-6">
            {/*
              * Not on Tool Use or RAG: both are served now, by /api/mcp/tools
              * and /api/documents. The banner is a statement about the data on
              * screen, so leaving it up over real, live data would be its own
              * small lie in the other direction.
              *
              * Extend this list as the other tabs get endpoints, and delete the
              * banner outright when none are left.
              */}
            {!SERVED_TABS.has(activeTab) && (
                <ExampleDataBanner
                    what="models, datasets, training jobs and devices"
                    endpoint="/api/datasets or /api/training"
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Developer</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Model training, optimization, and deployment pipeline
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 transition-colors">
                        <Plus size={18} />
                        New Job
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Cloud size={18} />
                        <span className="text-sm">Providers</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{inferenceEndpoints.length}</p>
                    <p className="text-sm text-green-500">
                        {inferenceEndpoints.filter(e => e.status === 'connected').length} connected
                    </p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Box size={18} />
                        <span className="text-sm">Models</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{pretrainedModels.length}</p>
                    <p className="text-sm text-green-500">{pretrainedModels.filter(m => m.downloaded).length} downloaded</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Database size={18} />
                        <span className="text-sm">Datasets</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{datasets.length}</p>
                    <p className="text-sm text-green-500">{datasets.filter(d => d.downloaded).length} downloaded</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Zap size={18} />
                        <span className="text-sm">Training Jobs</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{trainingJobs.filter(j => j.status === 'running').length}</p>
                    <p className="text-sm text-blue-500">active</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <HardDrive size={18} />
                        <span className="text-sm">Storage Used</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">24.8 GB</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">of 500 GB</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Cpu size={18} />
                        <span className="text-sm">GPU Utilization</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">87%</p>
                    <p className="text-sm text-orange-500">RTX 4090</p>
                </div>
            </div>

            {/* Connected Inference Providers */}
            {inferenceEndpoints.length > 0 && (
                <div className="bg-[hsl(var(--card))] rounded-xl border p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                            <Server size={18} />
                            Connected Inference Providers
                        </h3>
                        <span className="text-sm text-[hsl(var(--muted-foreground))]">
                            {inferenceEndpoints.reduce((acc, e) => acc + e.models.length, 0)} total models available
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {inferenceEndpoints.map(endpoint => (
                            <div key={endpoint.id} className="flex items-center justify-between p-3 bg-[hsl(var(--muted))]/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <span className={`w-2 h-2 rounded-full ${endpoint.status === 'connected' ? 'bg-green-500' :
                                            endpoint.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                                        }`} />
                                    <div>
                                        <p className="font-medium text-[hsl(var(--foreground))]">{endpoint.name}</p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                            {endpoint.models.length} models • {endpoint.type}
                                        </p>
                                    </div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${endpoint.status === 'connected' ? 'bg-green-500/20 text-green-400' :
                                        endpoint.status === 'error' ? 'bg-red-500/20 text-red-400' :
                                            'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                    {endpoint.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${activeTab === tab.id
                            ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                            : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                            }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'models' && (
                <div className="space-y-4">
                    {/* Search */}
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                            <input
                                type="text"
                                placeholder="Search models..."
                                value={modelSearch}
                                onChange={(e) => setModelSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            />
                        </div>
                        <button className="flex items-center gap-2 px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                            <Filter size={18} />
                            Filters
                        </button>
                    </div>

                    {/* Model Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {filteredModels.map(model => (
                            <div key={model.id} className="bg-[hsl(var(--card))] rounded-xl border p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                            {model.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-[hsl(var(--foreground))]">{model.name}</h3>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{model.provider}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs px-2 py-0.5 bg-[hsl(var(--muted))] rounded">{model.params}</span>
                                                <span className="text-xs px-2 py-0.5 bg-[hsl(var(--muted))] rounded">{model.format}</span>
                                                <span className="text-xs text-[hsl(var(--muted-foreground))]">{model.size}</span>
                                            </div>
                                        </div>
                                    </div>
                                    {model.downloaded ? (
                                        <span className="flex items-center gap-1 text-green-500 text-sm">
                                            <CheckCircle2 size={16} />
                                            Downloaded
                                        </span>
                                    ) : (
                                        <button
                                            disabled
                                            title="Chasm has no endpoint to download a model through."
                                            className="flex items-center gap-1 px-3 py-1.5 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-lg text-sm cursor-not-allowed"
                                        >
                                            <Download size={14} />
                                            Download
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                    {model.tasks.map(task => (
                                        <span key={task} className="text-xs px-2 py-1 bg-blue-500/10 text-blue-500 rounded-full">
                                            {task}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Browse More */}
                    <div className="flex justify-center">
                        <button className="flex items-center gap-2 px-4 py-2 text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] rounded-lg transition-colors">
                            Browse HuggingFace Hub
                            <ExternalLink size={16} />
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'datasets' && (
                <div className="space-y-4">
                    {/* Search */}
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                            <input
                                type="text"
                                placeholder="Search datasets..."
                                value={datasetSearch}
                                onChange={(e) => setDatasetSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            />
                        </div>
                        <button className="flex items-center gap-2 px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                            <Filter size={18} />
                            Filters
                        </button>
                    </div>

                    {/* Dataset Table */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b bg-[hsl(var(--muted))]/50">
                                    <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Dataset</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Source</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Size</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Samples</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Task</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Status</th>
                                    <th className="text-right px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDatasets.map(dataset => (
                                    <tr key={dataset.id} className="border-b last:border-b-0 hover:bg-[hsl(var(--muted))]/30">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Database size={16} className="text-[hsl(var(--muted-foreground))]" />
                                                <span className="font-medium text-[hsl(var(--foreground))]">{dataset.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{dataset.source}</td>
                                        <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{dataset.size}</td>
                                        <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{dataset.samples}</td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs px-2 py-1 bg-purple-500/10 text-purple-500 rounded-full">
                                                {dataset.tasks[0]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {dataset.downloaded ? (
                                                <span className="flex items-center gap-1 text-green-500 text-sm">
                                                    <CheckCircle2 size={14} />
                                                    Ready
                                                </span>
                                            ) : (
                                                <span className="text-sm text-[hsl(var(--muted-foreground))]">Not downloaded</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {!dataset.downloaded && (
                                                <button
                                                    disabled
                                                    title="Chasm has no endpoint to download a dataset through."
                                                    className="flex items-center gap-1 px-3 py-1 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded text-sm cursor-not-allowed ml-auto"
                                                >
                                                    <FileDown size={14} />
                                                    Download
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'training' && (
                <div className="space-y-6">
                    {/* Active Jobs */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">Training Jobs</h3>
                            <button className="flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                                <RefreshCw size={14} />
                                Refresh
                            </button>
                        </div>
                        <div className="divide-y">
                            {trainingJobs.map(job => (
                                <div key={job.id} className="p-4 flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(job.status)}
                                            <span className="font-medium text-[hsl(var(--foreground))]">{job.name}</span>
                                            <span className="text-xs px-2 py-0.5 bg-[hsl(var(--muted))] rounded capitalize">{job.type}</span>
                                        </div>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                            Model: {job.model} • GPU: {job.gpu} • ETA: {job.eta}
                                        </p>
                                    </div>
                                    <div className="w-48">
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="text-[hsl(var(--muted-foreground))]">Progress</span>
                                            <span className="font-medium text-[hsl(var(--foreground))]">{job.progress}%</span>
                                        </div>
                                        <div className="h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${job.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`}
                                                style={{ width: `${job.progress}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {job.status === 'running' && (
                                            <button className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                                                <Pause size={18} />
                                            </button>
                                        )}
                                        {job.status === 'queued' && (
                                            <button className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                                                <Play size={18} />
                                            </button>
                                        )}
                                        <button className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                                            <Settings size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Training Metrics Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Training Loss</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <AreaChart data={trainingMetrics}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="epoch" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--card))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '8px',
                                        }}
                                    />
                                    <Area type="monotone" dataKey="loss" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Train Loss" />
                                    <Area type="monotone" dataKey="val_loss" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Val Loss" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Training Configuration</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Training Type</label>
                                    <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]">
                                        <option>Full Fine-tuning</option>
                                        <option>LoRA</option>
                                        <option>QLoRA</option>
                                        <option>Prefix Tuning</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Epochs</label>
                                        <input type="number" defaultValue={10} className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Batch Size</label>
                                        <input type="number" defaultValue={8} className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Learning Rate</label>
                                    <input type="text" defaultValue="1e-4" className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]" />
                                </div>
                                <button className="w-full py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90">
                                    Start Training
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'optimization' && (
                <div className="space-y-6">
                    {/* Optimization Methods */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {compressionMethods.map(method => (
                            <div key={method.id} className="bg-[hsl(var(--card))] rounded-xl border p-4 hover:border-[hsl(var(--primary))] transition-colors cursor-pointer">
                                <div className="flex items-center gap-2 mb-3">
                                    {method.id.includes('quant') && <Layers size={20} className="text-blue-500" />}
                                    {method.id.includes('pruning') && <Scissors size={20} className="text-orange-500" />}
                                    {method.id.includes('distillation') && <GitBranch size={20} className="text-purple-500" />}
                                    {method.id.includes('low-rank') && <Minimize2 size={20} className="text-green-500" />}
                                    <h3 className="font-semibold text-[hsl(var(--foreground))]">{method.name}</h3>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-[hsl(var(--muted-foreground))]">Size Reduction</span>
                                        <span className="font-medium text-green-500">{method.reduction}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[hsl(var(--muted-foreground))]">Speedup</span>
                                        <span className="font-medium text-blue-500">{method.speedup}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[hsl(var(--muted-foreground))]">Quality Impact</span>
                                        <span className="font-medium text-[hsl(var(--foreground))]">{method.quality}</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-3">
                                    {method.supported.map(target => (
                                        <span key={target} className="text-xs px-2 py-0.5 bg-[hsl(var(--muted))] rounded">
                                            {target}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Optimization Pipeline */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                        <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Optimization Pipeline</h3>
                        <div className="flex items-center gap-4 overflow-x-auto pb-4">
                            {['Select Model', 'Choose Method', 'Configure', 'Optimize', 'Validate', 'Export'].map((step, index) => (
                                <div key={step} className="flex items-center gap-4">
                                    <div className={`flex flex-col items-center gap-2 min-w-[100px] ${index <= 1 ? 'opacity-100' : 'opacity-50'}`}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${index <= 1 ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted-foreground))]'}`}>
                                            {index + 1}
                                        </div>
                                        <span className="text-sm text-[hsl(var(--foreground))] whitespace-nowrap">{step}</span>
                                    </div>
                                    {index < 5 && <ChevronRight size={20} className="text-[hsl(var(--muted-foreground))]" />}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Source Model</label>
                                <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]">
                                    <option>Llama 3.2 3B</option>
                                    <option>Gemma 2 2B</option>
                                    <option>Code Llama 7B</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Optimization Method</label>
                                <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]">
                                    <option>INT8 Quantization</option>
                                    <option>INT4 Quantization</option>
                                    <option>Structured Pruning</option>
                                    <option>Knowledge Distillation</option>
                                </select>
                            </div>
                        </div>

                        <button className="mt-4 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90">
                            Run Optimization
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'deployment' && (
                <div className="space-y-6">
                    {/* Deployment Targets */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {deploymentTargets.map(target => (
                            <div
                                key={target.id}
                                className="bg-[hsl(var(--card))] rounded-xl border p-4 hover:border-[hsl(var(--primary))] transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: `${target.color}20` }}
                                    >
                                        <target.icon size={20} style={{ color: target.color }} />
                                    </div>
                                    <h3 className="font-semibold text-[hsl(var(--foreground))]">{target.name}</h3>
                                </div>
                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">{target.description}</p>
                                <div className="flex flex-wrap gap-1">
                                    {target.formats.map(format => (
                                        <span key={format} className="text-xs px-2 py-0.5 bg-[hsl(var(--muted))] rounded">
                                            {format}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Deployment Configuration */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Export Configuration</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Model</label>
                                    <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]">
                                        <option>Llama 3.2 3B (Quantized INT8)</option>
                                        <option>Gemma 2 2B (Original)</option>
                                        <option>Code Llama 7B (Pruned)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Target Platform</label>
                                    <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]">
                                        <option>CPU (GGUF)</option>
                                        <option>GPU - NVIDIA (TensorRT)</option>
                                        <option>NPU - Apple (Core ML)</option>
                                        <option>Edge - Mobile (TFLite)</option>
                                        <option>MCU - Embedded (TFLite Micro)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Quantization</label>
                                    <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]">
                                        <option>Q8_0 (8-bit)</option>
                                        <option>Q4_K_M (4-bit)</option>
                                        <option>Q4_0 (4-bit fast)</option>
                                        <option>Q2_K (2-bit)</option>
                                    </select>
                                </div>
                                <button className="w-full py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 flex items-center justify-center gap-2">
                                    <Rocket size={18} />
                                    Export Model
                                </button>
                            </div>
                        </div>

                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Exported Models</h3>
                            <div className="space-y-3">
                                {[
                                    { name: 'llama-3.2-3b-q8.gguf', size: '3.4 GB', target: 'CPU', date: '2 hours ago' },
                                    { name: 'gemma-2-2b.mlmodel', size: '4.2 GB', target: 'NPU', date: '1 day ago' },
                                    { name: 'codellama-7b-q4.onnx', size: '2.1 GB', target: 'GPU', date: '3 days ago' },
                                ].map((model, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-[hsl(var(--muted))]/50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Package size={18} className="text-[hsl(var(--muted-foreground))]" />
                                            <div>
                                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">{model.name}</p>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{model.size} • {model.target} • {model.date}</p>
                                            </div>
                                        </div>
                                        <button className="p-2 rounded-lg hover:bg-[hsl(var(--muted))]">
                                            <Download size={16} className="text-[hsl(var(--muted-foreground))]" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Hardware Compatibility Matrix */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                        <div className="p-4 border-b">
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">Hardware Compatibility</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b bg-[hsl(var(--muted))]/50">
                                        <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Model</th>
                                        <th className="text-center px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">MCU</th>
                                        <th className="text-center px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">CPU</th>
                                        <th className="text-center px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">GPU</th>
                                        <th className="text-center px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">NPU</th>
                                        <th className="text-center px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Edge</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { name: 'Llama 3.2 1B', mcu: false, cpu: true, gpu: true, npu: true, edge: true },
                                        { name: 'Llama 3.2 3B', mcu: false, cpu: true, gpu: true, npu: true, edge: true },
                                        { name: 'Phi-3 Mini', mcu: false, cpu: true, gpu: true, npu: true, edge: true },
                                        { name: 'Gemma 2 2B', mcu: false, cpu: true, gpu: true, npu: true, edge: true },
                                        { name: 'TinyLlama', mcu: true, cpu: true, gpu: true, npu: true, edge: true },
                                    ].map((row, index) => (
                                        <tr key={index} className="border-b last:border-b-0">
                                            <td className="px-4 py-3 font-medium text-[hsl(var(--foreground))]">{row.name}</td>
                                            {[row.mcu, row.cpu, row.gpu, row.npu, row.edge].map((supported, i) => (
                                                <td key={i} className="px-4 py-3 text-center">
                                                    {supported ? (
                                                        <CheckCircle2 size={18} className="text-green-500 mx-auto" />
                                                    ) : (
                                                        <AlertCircle size={18} className="text-[hsl(var(--muted-foreground))] mx-auto" />
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* RAG Tab
              *
              * Served by `/api/documents`: the server chunks what is ingested,
              * embeds the chunks and retrieves them by meaning.
              *
              * What was here before described five vector databases holding
              * 9.5M vectors across four RAG pipelines answering 5,540 queries
              * a day, on an install that had never indexed anything. None of
              * those numbers came from anywhere, and none of the buttons had a
              * handler -- including the ingestion dropzone, which had no drop
              * handler either.
              *
              * The knowledge base is one store, not five: the counts below are
              * over that store, and there is nothing to invent.
              */}
            {activeTab === 'rag' && (
                <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <BookOpen size={18} />
                                <span className="text-sm">Documents</span>
                            </div>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                {documentsLoading ? '…' : docs.length}
                            </p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">ingested</p>
                        </div>
                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <Layers size={18} />
                                <span className="text-sm">Chunks Indexed</span>
                            </div>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                {documentsLoading ? '…' : docs.reduce((sum, d) => sum + d.chunkCount, 0).toLocaleString()}
                            </p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">embedded and searchable</p>
                        </div>
                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <Database size={18} />
                                <span className="text-sm">Embedding Model</span>
                            </div>
                            <p className="text-lg font-bold text-[hsl(var(--foreground))] truncate">
                                {docs[0]?.embeddingModel ?? '—'}
                            </p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                {docs.length === 0 ? 'nothing ingested yet' : 'as configured on the server'}
                            </p>
                        </div>
                    </div>

                    {documentsError && (
                        <div className="bg-[hsl(var(--card))] rounded-xl border border-red-500/40 p-4 text-sm text-[hsl(var(--muted-foreground))]">
                            Could not load documents: {documentsError.message}
                        </div>
                    )}

                    {/* Ingest */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-6 space-y-4">
                        <div>
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">Ingest a Document</h3>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                Chunked, embedded and stored server-side. Needs an embedding model configured
                                on the server; without one the server refuses rather than storing something
                                that could never be retrieved.
                            </p>
                        </div>
                        <input
                            className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]"
                            placeholder="Title"
                            value={ingestTitle}
                            onChange={e => setIngestTitle(e.target.value)}
                        />
                        <textarea
                            className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] font-mono text-sm h-40 resize-none"
                            placeholder="Paste the document text here"
                            value={ingestContent}
                            onChange={e => setIngestContent(e.target.value)}
                        />
                        <div className="flex items-center gap-3">
                            <select
                                className="px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]"
                                value={ingestStrategy}
                                onChange={e => setIngestStrategy(e.target.value)}
                            >
                                {CHUNKING_STRATEGIES.map(strategy => (
                                    <option key={strategy.value} value={strategy.value}>{strategy.label}</option>
                                ))}
                            </select>
                            <button
                                className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
                                onClick={handleIngest}
                                disabled={!ingestTitle.trim() || !ingestContent.trim() || ingestDocument.isLoading}
                            >
                                <Upload size={16} />
                                {ingestDocument.isLoading ? 'Ingesting…' : 'Ingest'}
                            </button>
                            {ingestMessage && (
                                <span className={`text-sm ${ingestMessage.isError ? 'text-red-500' : 'text-green-500'}`}>
                                    {ingestMessage.text}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Retrieve */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-6 space-y-4">
                        <div>
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">Retrieve</h3>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                Ranked by meaning, never by substring. The server reports how many chunks it
                                compared, so an empty knowledge base is distinguishable from a query that
                                matched nothing.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                className="flex-1 px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]"
                                placeholder="What are you looking for?"
                                value={ragQuery}
                                onChange={e => setRagQuery(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleRagSearch(); }}
                            />
                            <button
                                className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
                                onClick={handleRagSearch}
                                disabled={!ragQuery.trim() || searchDocuments.isLoading}
                            >
                                <Search size={16} />
                                {searchDocuments.isLoading ? 'Searching…' : 'Search'}
                            </button>
                        </div>

                        {ragError && <p className="text-sm text-red-500">{ragError}</p>}

                        {ragResults && (
                            <div className="space-y-3">
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    {ragResults.results.length} match{ragResults.results.length === 1 ? '' : 'es'} across{' '}
                                    {ragResults.searched.toLocaleString()} chunk{ragResults.searched === 1 ? '' : 's'} compared.
                                    {ragResults.searched === 0 && ' Nothing has been ingested under the current embedding model.'}
                                </p>
                                {ragResults.results.map(match => (
                                    <div key={`${match.documentId}-${match.chunkIndex}`} className="bg-[hsl(var(--muted))]/50 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium text-[hsl(var(--foreground))]">{match.documentTitle}</span>
                                            <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                                                chunk {match.chunkIndex} · {match.score.toFixed(3)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))] whitespace-pre-wrap">{match.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Stored documents */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border">
                        <div className="p-4 border-b">
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">Stored Documents</h3>
                        </div>
                        {!documentsLoading && docs.length === 0 ? (
                            <p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">
                                Nothing ingested yet.
                            </p>
                        ) : (
                            <div className="divide-y divide-[hsl(var(--border))]">
                                {docs.map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between p-4">
                                        <div className="min-w-0">
                                            <p className="font-medium text-[hsl(var(--foreground))] truncate">{doc.title}</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                {doc.chunkCount} chunk{doc.chunkCount === 1 ? '' : 's'} ·{' '}
                                                {doc.chunkingStrategy} · {doc.source} · {doc.embeddingModel}
                                            </p>
                                        </div>
                                        <button
                                            className="p-2 rounded hover:bg-[hsl(var(--muted))] shrink-0"
                                            onClick={() => handleDeleteDocument(doc.id)}
                                            title="Delete this document and its chunks"
                                        >
                                            <Trash2 size={16} className="text-red-500" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tool Use Tab */}
            {activeTab === 'tools' && (
                <div className="space-y-6">
                    {/* Tool Stats
                      *
                      * Two cards, not four. "Total Calls: 12,340 this month" and
                      * "Most Used: execute_code, 4,100 calls" used to sit beside
                      * these: Chasm records no tool-call counts anywhere, so
                      * both were sums over invented fixture fields. They are
                      * gone rather than em-dashed -- the figure is not unknown,
                      * it is unmeasured.
                      */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <Wrench size={18} />
                                <span className="text-sm">Tools Served</span>
                            </div>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                {toolsLoading ? '…' : tools.length}
                            </p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">over MCP</p>
                        </div>
                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <Link size={18} />
                                <span className="text-sm">Schema Formats</span>
                            </div>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{Object.keys(toolSchemas).length}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">served verbatim</p>
                        </div>
                    </div>

                    {toolsError && (
                        <div className="bg-[hsl(var(--card))] rounded-xl border border-red-500/40 p-4 text-sm text-[hsl(var(--muted-foreground))]">
                            Could not load tools from the server: {toolsError.message}
                        </div>
                    )}

                    {/* Tool Definitions */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border">
                        <div className="p-4 border-b">
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">Tool Definitions</h3>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                Served by the running server over <code className="font-mono">/api/mcp/tools</code>. The
                                catalogue is compiled in, so there is nothing here to add, edit or delete.
                            </p>
                        </div>
                        {!toolsLoading && tools.length === 0 && !toolsError && (
                            <p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">
                                The server reports no tools.
                            </p>
                        )}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                            {tools.map(tool => {
                                const params = toolParams(tool.inputSchema);
                                return (
                                    <div key={tool.name} className="bg-[hsl(var(--muted))]/50 rounded-lg p-4">
                                        <div className="mb-2">
                                            <code className="font-mono font-medium text-[hsl(var(--primary))]">{tool.name}</code>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                                {tool.description || 'No description supplied.'}
                                            </p>
                                        </div>
                                        <div className="space-y-1 mt-3">
                                            {params.length === 0 ? (
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Takes no arguments.</p>
                                            ) : (
                                                params.map(param => (
                                                    <div key={param.name} className="flex items-center gap-2 text-xs">
                                                        <code className="font-mono text-[hsl(var(--foreground))]">{param.name}</code>
                                                        <span className="text-purple-500">{param.type}</span>
                                                        {param.required && <span className="text-red-500">*</span>}
                                                        <span className="text-[hsl(var(--muted-foreground))] truncate">{param.description}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Schema Export */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Export Schema</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Schema Format</label>
                                    <select
                                        className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]"
                                        value={schemaFormat}
                                        onChange={e => setSchemaFormat(e.target.value as keyof typeof toolSchemas)}
                                    >
                                        {Object.entries(toolSchemas).map(([key, value]) => (
                                            <option key={key} value={key}>{value}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Select Tools</label>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {tools.map(tool => (
                                            <label key={tool.name} className="flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    className="rounded"
                                                    checked={selectedTools.has(tool.name)}
                                                    onChange={e => {
                                                        setSelectedTools(prev => {
                                                            const next = new Set(prev);
                                                            if (e.target.checked) next.add(tool.name);
                                                            else next.delete(tool.name);
                                                            return next;
                                                        });
                                                    }}
                                                />
                                                <span className="text-[hsl(var(--foreground))]">{tool.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    className="w-full py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                                    onClick={handleGenerateSchema}
                                    disabled={selectedTools.size === 0}
                                >
                                    <FileCode size={18} />
                                    Generate Schema
                                </button>
                                {generatedSchema && (
                                    <pre className="bg-[hsl(var(--muted))] rounded-lg p-3 text-xs font-mono overflow-auto max-h-64 text-[hsl(var(--foreground))]">
                                        {generatedSchema}
                                    </pre>
                                )}
                            </div>
                        </div>

                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Tool Testing</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Select Tool</label>
                                    <select
                                        className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]"
                                        value={testToolName}
                                        onChange={e => setTestToolName(e.target.value)}
                                    >
                                        {tools.map(tool => (
                                            <option key={tool.name} value={tool.name}>{tool.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Test Input (JSON)</label>
                                    <textarea
                                        className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] font-mono text-sm h-24 resize-none"
                                        placeholder='{"query": "deadlock"}'
                                        value={testInput}
                                        onChange={e => setTestInput(e.target.value)}
                                    />
                                </div>
                                <button
                                    className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50"
                                    onClick={handleExecuteTool}
                                    disabled={!testToolName || callTool.isLoading}
                                >
                                    <Terminal size={18} />
                                    {callTool.isLoading ? 'Running…' : 'Execute Tool'}
                                </button>
                                {testOutput && (
                                    <pre
                                        className={`rounded-lg p-3 text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap ${
                                            testOutput.isError
                                                ? 'bg-red-500/10 text-red-500'
                                                : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                                        }`}
                                    >
                                        {testOutput.text}
                                    </pre>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Multi-Modal Tab */}
            {activeTab === 'multimodal' && (
                <div className="space-y-6">
                    {/* Multi-Modal Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <Sparkles size={18} />
                                <span className="text-sm">Available Models</span>
                            </div>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{multiModalModels.length}</p>
                            <p className="text-sm text-green-500">{multiModalModels.filter(m => m.status === 'available').length} cloud + {multiModalModels.filter(m => m.status === 'local').length} local</p>
                        </div>
                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <Image size={18} />
                                <span className="text-sm">Vision Models</span>
                            </div>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{multiModalModels.filter(m => m.modalities.includes('image')).length}</p>
                            <p className="text-sm text-blue-500">image input</p>
                        </div>
                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <Music size={18} />
                                <span className="text-sm">Audio Models</span>
                            </div>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{multiModalModels.filter(m => m.modalities.includes('audio')).length}</p>
                            <p className="text-sm text-purple-500">audio capable</p>
                        </div>
                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <Video size={18} />
                                <span className="text-sm">Video Models</span>
                            </div>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{multiModalModels.filter(m => m.modalities.includes('video')).length}</p>
                            <p className="text-sm text-orange-500">video input</p>
                        </div>
                    </div>

                    {/* Model Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {multiModalModels.map(model => (
                            <div key={model.id} className="bg-[hsl(var(--card))] rounded-xl border p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold">
                                            <Sparkles size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-[hsl(var(--foreground))]">{model.name}</h3>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{model.provider}</p>
                                        </div>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded ${model.status === 'available' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                        {model.status}
                                    </span>
                                </div>

                                {/* Modalities */}
                                <div className="mt-4">
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">Modalities</p>
                                    <div className="flex items-center gap-2">
                                        {model.modalities.map(mod => {
                                            const IconComponent = modalityIcons[mod] || FileText;
                                            return (
                                                <div key={mod} className="flex items-center gap-1 px-2 py-1 bg-[hsl(var(--muted))] rounded">
                                                    <IconComponent size={14} className="text-[hsl(var(--primary))]" />
                                                    <span className="text-xs text-[hsl(var(--foreground))] capitalize">{mod}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Input/Output Types */}
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Input Types</p>
                                        <div className="flex flex-wrap gap-1">
                                            {model.inputTypes.map(type => (
                                                <span key={type} className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded">{type}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Output Types</p>
                                        <div className="flex flex-wrap gap-1">
                                            {model.outputTypes.map(type => (
                                                <span key={type} className="text-xs px-2 py-0.5 bg-green-500/10 text-green-500 rounded">{type}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[hsl(var(--border))] text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Context: {model.maxTokens.toLocaleString()} tokens</span>
                                    <span className="text-[hsl(var(--muted-foreground))]">{model.pricing}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Multi-Modal Playground */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                        <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Multi-Modal Playground</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Input Area */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Select Model</label>
                                    <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]">
                                        {multiModalModels.map(model => (
                                            <option key={model.id} value={model.id}>{model.name} ({model.provider})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Media Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Media Input</label>
                                    <div className="border-2 border-dashed border-[hsl(var(--border))] rounded-lg p-4 text-center">
                                        <div className="flex items-center justify-center gap-4 mb-2">
                                            <Image size={24} className="text-[hsl(var(--muted-foreground))]" />
                                            <Music size={24} className="text-[hsl(var(--muted-foreground))]" />
                                            <Video size={24} className="text-[hsl(var(--muted-foreground))]" />
                                        </div>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Drop images, audio, or video files</p>
                                        <button className="mt-2 px-3 py-1.5 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded text-sm">
                                            Browse Files
                                        </button>
                                    </div>
                                </div>

                                {/* Text Prompt */}
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Text Prompt</label>
                                    <textarea
                                        className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] h-24 resize-none"
                                        placeholder="Describe what you want the model to do..."
                                    />
                                </div>

                                <button className="w-full py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 flex items-center justify-center gap-2">
                                    <Sparkles size={18} />
                                    Generate
                                </button>
                            </div>

                            {/* Output Area */}
                            <div className="bg-[hsl(var(--muted))]/50 rounded-lg p-4 min-h-[300px] flex items-center justify-center">
                                <div className="text-center text-[hsl(var(--muted-foreground))]">
                                    <Sparkles size={40} className="mx-auto mb-2 opacity-50" />
                                    <p>Output will appear here</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Capability Matrix */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                        <div className="p-4 border-b">
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">Capability Matrix</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b bg-[hsl(var(--muted))]/50">
                                        <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Model</th>
                                        <th className="text-center px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">
                                            <div className="flex items-center justify-center gap-1"><FileText size={14} /> Text</div>
                                        </th>
                                        <th className="text-center px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">
                                            <div className="flex items-center justify-center gap-1"><Image size={14} /> Image</div>
                                        </th>
                                        <th className="text-center px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">
                                            <div className="flex items-center justify-center gap-1"><Music size={14} /> Audio</div>
                                        </th>
                                        <th className="text-center px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">
                                            <div className="flex items-center justify-center gap-1"><Video size={14} /> Video</div>
                                        </th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Context</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {multiModalModels.map((model) => (
                                        <tr key={model.id} className="border-b last:border-b-0">
                                            <td className="px-4 py-3">
                                                <span className="font-medium text-[hsl(var(--foreground))]">{model.name}</span>
                                                <span className="text-xs text-[hsl(var(--muted-foreground))] ml-2">({model.provider})</span>
                                            </td>
                                            {['text', 'image', 'audio', 'video'].map((mod) => (
                                                <td key={mod} className="px-4 py-3 text-center">
                                                    {model.modalities.includes(mod) ? (
                                                        <CheckCircle2 size={18} className="text-green-500 mx-auto" />
                                                    ) : (
                                                        <AlertCircle size={18} className="text-[hsl(var(--muted-foreground))] mx-auto" />
                                                    )}
                                                </td>
                                            ))}
                                            <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                                                {model.maxTokens >= 1000000 ? `${(model.maxTokens / 1000000).toFixed(1)}M` : `${(model.maxTokens / 1000).toFixed(0)}K`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Simulation Tab */}
            {activeTab === 'simulation' && (
                <div className="space-y-6">
                    {/* Simulator Connections */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">Photorealistic Simulators</h2>
                            <button className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90">
                                <Plus size={18} />
                                Connect Simulator
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {simulators.map((sim) => (
                                <div key={sim.id} className="bg-[hsl(var(--card))] rounded-xl border p-5 hover:border-[hsl(var(--primary))] transition-colors">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-[hsl(var(--primary)/0.1)] rounded-lg flex items-center justify-center">
                                                <sim.icon size={20} className="text-[hsl(var(--primary))]" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-[hsl(var(--foreground))]">{sim.name}</h3>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{sim.provider} • {sim.category}</p>
                                            </div>
                                        </div>
                                        <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${sim.status === 'connected'
                                            ? 'bg-green-500/10 text-green-500'
                                            : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${sim.status === 'connected' ? 'bg-green-500' : 'bg-[hsl(var(--muted-foreground))]'}`} />
                                            {sim.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">{sim.description}</p>
                                    <div className="mb-3">
                                        <p className="text-xs font-medium text-[hsl(var(--foreground))] mb-1">Data Outputs:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {sim.dataTypes.slice(0, 4).map((dt) => (
                                                <span key={dt} className="text-xs px-2 py-0.5 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded">
                                                    {dt}
                                                </span>
                                            ))}
                                            {sim.dataTypes.length > 4 && (
                                                <span className="text-xs px-2 py-0.5 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded">
                                                    +{sim.dataTypes.length - 4} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-3 border-t">
                                        <code className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-2 py-1 rounded">
                                            {sim.apiEndpoint}
                                        </code>
                                        <div className="flex items-center gap-2">
                                            <button className="p-1.5 hover:bg-[hsl(var(--muted))] rounded" title="Settings">
                                                <Settings size={16} className="text-[hsl(var(--muted-foreground))]" />
                                            </button>
                                            <button className="p-1.5 hover:bg-[hsl(var(--muted))] rounded" title="Test Connection">
                                                <RefreshCw size={16} className="text-[hsl(var(--muted-foreground))]" />
                                            </button>
                                            {sim.status === 'connected' ? (
                                                <button className="flex items-center gap-1 px-3 py-1.5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded text-sm hover:opacity-90">
                                                    <Play size={14} />
                                                    Generate
                                                </button>
                                            ) : (
                                                <button className="flex items-center gap-1 px-3 py-1.5 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded text-sm hover:bg-[hsl(var(--muted))]/80">
                                                    <Link size={14} />
                                                    Connect
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Data Generation Jobs */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">Synthetic Data Jobs</h2>
                            <button className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg hover:bg-[hsl(var(--muted))]/80">
                                <Plus size={18} />
                                New Job
                            </button>
                        </div>
                        <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b bg-[hsl(var(--muted))]/50">
                                        <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Job Name</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Simulator</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Scenes</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Progress</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Output Size</th>
                                        <th className="text-right px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {syntheticDataJobs.map((job) => (
                                        <tr key={job.id} className="border-b last:border-b-0 hover:bg-[hsl(var(--muted))]/30">
                                            <td className="px-4 py-3">
                                                <span className="font-medium text-[hsl(var(--foreground))]">{job.name}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{job.simulator}</td>
                                            <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{job.scenes.toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(job.status)}
                                                    <div className="flex-1 h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden max-w-[100px]">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${job.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                                                                }`}
                                                            style={{ width: `${job.progress}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{job.progress}%</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{job.outputSize}</td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {job.status === 'running' && (
                                                        <button className="p-1.5 hover:bg-[hsl(var(--muted))] rounded" title="Pause">
                                                            <Pause size={16} className="text-[hsl(var(--muted-foreground))]" />
                                                        </button>
                                                    )}
                                                    {job.status === 'completed' && (
                                                        <button className="p-1.5 hover:bg-[hsl(var(--muted))] rounded" title="Download">
                                                            <Download size={16} className="text-[hsl(var(--muted-foreground))]" />
                                                        </button>
                                                    )}
                                                    <button className="p-1.5 hover:bg-[hsl(var(--muted))] rounded" title="View Details">
                                                        <Eye size={16} className="text-[hsl(var(--muted-foreground))]" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Domain Randomization */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Domain Randomization</h3>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                                Configure augmentation parameters to improve sim-to-real transfer
                            </p>
                            <div className="space-y-3">
                                {dataAugmentations.map((aug) => (
                                    <div key={aug.id} className="flex items-center justify-between p-3 bg-[hsl(var(--muted))]/50 rounded-lg">
                                        <div>
                                            <p className="text-sm font-medium text-[hsl(var(--foreground))]">{aug.name}</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{aug.description}</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" defaultChecked={aug.id !== 'occlusion'} />
                                            <div className="w-9 h-5 bg-[hsl(var(--muted))] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[hsl(var(--primary))]"></div>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Generation Config</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Output Format</label>
                                    <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]">
                                        <option>COCO JSON</option>
                                        <option>YOLO TXT</option>
                                        <option>Pascal VOC XML</option>
                                        <option>TFRecord</option>
                                        <option>Custom</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Resolution</label>
                                        <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]">
                                            <option>1920x1080</option>
                                            <option>1280x720</option>
                                            <option>640x480</option>
                                            <option>Custom</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Frame Rate</label>
                                        <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]">
                                            <option>30 FPS</option>
                                            <option>60 FPS</option>
                                            <option>10 FPS</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Scenes to Generate</label>
                                    <input type="number" defaultValue={10000} className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">Data Modalities</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['RGB', 'Depth', 'Segmentation', 'Normals', 'Optical Flow', 'Bounding Boxes'].map((mod) => (
                                            <label key={mod} className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--muted))] rounded-lg cursor-pointer hover:bg-[hsl(var(--muted))]/80">
                                                <input type="checkbox" className="rounded" defaultChecked={['RGB', 'Depth', 'Segmentation'].includes(mod)} />
                                                <span className="text-sm text-[hsl(var(--foreground))]">{mod}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <button className="w-full py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 flex items-center justify-center gap-2">
                                    <Play size={18} />
                                    Start Generation
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Robotics Tab */}
            {activeTab === 'robotics' && (
                <div className="space-y-6">
                    {/* Robotics Platforms */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                        {roboticsPlatforms.map((platform) => (
                            <div key={platform.id} className="bg-[hsl(var(--card))] rounded-xl border p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-lg ${platform.status === 'connected' ? 'bg-green-500/10' : 'bg-gray-500/10'}`}>
                                            <Compass size={20} className={platform.status === 'connected' ? 'text-green-500' : 'text-gray-500'} />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-[hsl(var(--foreground))]">{platform.name}</h4>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{platform.type}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs ${platform.status === 'connected' ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                                        {platform.status}
                                    </span>
                                </div>
                                <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">{platform.description}</p>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-[hsl(var(--muted))]/50 rounded p-2">
                                        <p className="text-lg font-bold text-[hsl(var(--foreground))]">{platform.nodes}</p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">Nodes</p>
                                    </div>
                                    <div className="bg-[hsl(var(--muted))]/50 rounded p-2">
                                        <p className="text-lg font-bold text-[hsl(var(--foreground))]">{platform.topics}</p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">Topics</p>
                                    </div>
                                    <div className="bg-[hsl(var(--muted))]/50 rounded p-2">
                                        <p className="text-lg font-bold text-[hsl(var(--foreground))]">{platform.services}</p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">Services</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Robot Hardware */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h3 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                                <Hand size={20} className="text-[hsl(var(--primary))]" />
                                Robot Hardware
                            </h3>
                            <button className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg text-sm hover:opacity-90">
                                <Plus size={16} />
                                Add Robot
                            </button>
                        </div>
                        <table className="w-full">
                            <thead className="bg-[hsl(var(--muted))]/30">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Robot</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Type</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">DOF</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Payload</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Reach</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Status</th>
                                    <th className="text-right px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {robotHardware.map((robot) => (
                                    <tr key={robot.id} className="border-b last:border-b-0 hover:bg-[hsl(var(--muted))]/30">
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-[hsl(var(--foreground))]">{robot.name}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{robot.type}</td>
                                        <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{robot.dof}</td>
                                        <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{robot.payload}</td>
                                        <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{robot.reach}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs ${robot.status === 'connected' ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                                                {robot.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button className="p-1.5 hover:bg-[hsl(var(--muted))] rounded" title="Connect">
                                                    <RefreshCw size={16} className="text-[hsl(var(--muted-foreground))]" />
                                                </button>
                                                <button className="p-1.5 hover:bg-[hsl(var(--muted))] rounded" title="Settings">
                                                    <Settings size={16} className="text-[hsl(var(--muted-foreground))]" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Sensors */}
                        <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                            <div className="p-4 border-b flex items-center justify-between">
                                <h3 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                                    <Radar size={20} className="text-[hsl(var(--primary))]" />
                                    Sensors
                                </h3>
                                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                    {robotSensors.filter(s => s.status === 'active').length}/{robotSensors.length} active
                                </span>
                            </div>
                            <div className="divide-y">
                                {robotSensors.map((sensor) => (
                                    <div key={sensor.id} className="p-3 flex items-center justify-between hover:bg-[hsl(var(--muted))]/30">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${sensor.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                                            <div>
                                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">{sensor.name}</p>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{sensor.type} • {sensor.interface}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs text-[hsl(var(--muted-foreground))]">{sensor.fps} Hz</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Active Tasks */}
                        <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                            <div className="p-4 border-b flex items-center justify-between">
                                <h3 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                                    <Zap size={20} className="text-[hsl(var(--primary))]" />
                                    Robot Tasks
                                </h3>
                                <button className="text-sm text-[hsl(var(--primary))] hover:underline">View All</button>
                            </div>
                            <div className="divide-y">
                                {robotTasks.map((task) => (
                                    <div key={task.id} className="p-3 hover:bg-[hsl(var(--muted))]/30">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(task.status)}
                                                <span className="font-medium text-[hsl(var(--foreground))]">{task.name}</span>
                                            </div>
                                            <span className="text-xs text-[hsl(var(--muted-foreground))]">{task.robot}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-[hsl(var(--muted-foreground))]">
                                                Success: <span className="text-green-500 font-medium">{task.success}%</span>
                                            </span>
                                            <span className="text-[hsl(var(--muted-foreground))]">
                                                {task.attempts} attempts • Avg: {task.avgTime}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                        <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <button className="p-4 bg-[hsl(var(--muted))]/50 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors text-center">
                                <Terminal size={24} className="mx-auto mb-2 text-[hsl(var(--primary))]" />
                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">ROS Terminal</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Open ROS 2 shell</p>
                            </button>
                            <button className="p-4 bg-[hsl(var(--muted))]/50 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors text-center">
                                <Eye size={24} className="mx-auto mb-2 text-[hsl(var(--primary))]" />
                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">RViz</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">3D visualization</p>
                            </button>
                            <button className="p-4 bg-[hsl(var(--muted))]/50 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors text-center">
                                <GitBranch size={24} className="mx-auto mb-2 text-[hsl(var(--primary))]" />
                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">TF Tree</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Transform frames</p>
                            </button>
                            <button className="p-4 bg-[hsl(var(--muted))]/50 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors text-center">
                                <Activity size={24} className="mx-auto mb-2 text-[hsl(var(--primary))]" />
                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">rqt Graph</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Node graph</p>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};