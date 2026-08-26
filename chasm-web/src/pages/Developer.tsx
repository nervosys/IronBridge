// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { useState, useMemo, useEffect } from 'react';
import {
    Download,
    Database,
    Zap,
    Layers,
    Search,
    ExternalLink,
    Server,
    Plus,
    FileDown,
    Box,
    BookOpen,
    Wrench,
    Link,
    Upload,
    Terminal,
    Trash2,
    XCircle,
    FileCode,
    Cloud,
} from 'lucide-react';
import {
    useProviders,
    useProviderHealth,
    useMcpTools,
    useCallMcpTool,
    useDocuments,
    useIngestDocument,
    useSearchDocuments,
    useDeleteDocument,
    useDatasets,
    useCreateDataset,
    useDeleteDataset,
    useCatalogSearch,
    useDownloads,
    useStartDownload,
    useCancelDownload,
    useRepoFiles,
    useTrainingJobs,
    useValidateDataset,
    useStartTraining,
    useCancelTraining,
} from '../hooks/useApi';
import type {
    DocumentSearchResults,
    DatasetType,
    CatalogEntry,
    DatasetValidation,
} from '../api/client';

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
// The model and dataset catalogues are served, not declared here.
//
// Eight models and six datasets used to sit in this spot, each with a size,
// a parameter or sample count, a format and a `downloaded` flag -- "6.4 GB",
// "3B", "GGUF", "4.2M samples". The Hugging Face Hub's search API reports
// none of those, so they were invented. `/api/catalog` serves what the Hub
// actually publishes.

// Training jobs are served, not declared here.
//
// Four sat in this spot at 67% and 34% complete, with ETAs and an "RTX 4090",
// on an install that had never trained anything. A fine-tuning API reports a
// status and nothing resembling a percentage, so /api/training shows a status.

const toolSchemas = {
    openai: 'OpenAI Function Calling',
    mcp: 'Model Context Protocol',
};

/**
 * Compact a download count.
 *
 * The Hub reports these exactly (6,423,491) and a table column cannot hold
 * that many digits. Rounding a real measurement for display is fine; the
 * numbers this page used to show were not measurements at all.
 */
function compactCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
}

/** The dataset types `/api/datasets` accepts. */
const DATASET_TYPES: DatasetType[] = ['conversations', 'documents', 'qa', 'custom'];

/**
 * Render a byte count the server measured.
 *
 * Sizes on this page used to be fixture strings -- "12.5 GB", "1.8 GB" --
 * beside sample counts like "4.2M" for data that did not exist. What the
 * stored-datasets table shows is the length of what is actually on disk.
 */
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

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


type Tab = 'models' | 'datasets' | 'training' | 'rag' | 'tools';

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

    // Fine-tuning, served by /api/training.
    //
    // Polled while a job is unfinished: every read refreshes it from the
    // provider, so asking again is the only way a status advances.
    const [trainingPollMs, setTrainingPollMs] = useState<number | undefined>(undefined);
    const {
        data: trainingData,
        error: trainingListError,
        refetch: refetchTraining,
    } = useTrainingJobs({ refetchInterval: trainingPollMs });
    const trainingJobs = useMemo(() => trainingData ?? [], [trainingData]);

    const validateDataset = useValidateDataset();
    const startTraining = useStartTraining();
    const cancelTraining = useCancelTraining();

    const [trainDatasetId, setTrainDatasetId] = useState('');
    const [trainBaseModel, setTrainBaseModel] = useState('gpt-4o-mini-2024-07-18');
    const [trainSuffix, setTrainSuffix] = useState('');
    const [validation, setValidation] = useState<DatasetValidation | null>(null);
    const [trainMessage, setTrainMessage] = useState<{ text: string; isError: boolean } | null>(null);

    useEffect(() => {
        const unfinished = trainingJobs.some(
            j => !['succeeded', 'failed', 'cancelled'].includes(j.status)
        );
        setTrainingPollMs(unfinished ? 5000 : undefined);
    }, [trainingJobs]);

    // Clear a stale verdict when the dataset changes: a green tick belonging
    // to a different dataset is worse than no tick.
    useEffect(() => {
        setValidation(null);
        setTrainMessage(null);
    }, [trainDatasetId]);

    const runValidation = async () => {
        if (!trainDatasetId) return;
        setTrainMessage(null);
        try {
            setValidation(await validateDataset.mutate(trainDatasetId));
        } catch (err) {
            setTrainMessage({
                text: err instanceof Error ? err.message : 'Could not validate that dataset.',
                isError: true,
            });
        }
    };

    const submitTraining = async () => {
        if (!trainDatasetId || !trainBaseModel.trim()) return;
        setTrainMessage(null);
        try {
            const job = await startTraining.mutate({
                datasetId: trainDatasetId,
                baseModel: trainBaseModel.trim(),
                suffix: trainSuffix.trim() || undefined,
            });
            setTrainMessage(
                job
                    ? { text: `Submitted as ${job.providerJobId}.`, isError: false }
                    : { text: 'The server returned no job for the submission.', isError: true }
            );
            await refetchTraining();
            setTrainingPollMs(5000);
        } catch (err) {
            // The server's message is the useful one -- it carries the
            // provider's own refusal, or the count of dataset problems.
            setTrainMessage({
                text: err instanceof Error ? err.message : 'The submission was refused.',
                isError: true,
            });
        }
    };

    const stopTraining = async (id: string) => {
        try {
            await cancelTraining.mutate(id);
            await refetchTraining();
        } catch (err) {
            setTrainMessage({
                text: err instanceof Error ? err.message : 'Could not cancel that job.',
                isError: true,
            });
        }
    };

    // Downloads, served by /api/downloads.
    //
    // Polled only while something is running: progress is written by the
    // transfer, so it advances between requests -- but a page that kept
    // polling an idle server would do so forever for nothing.
    const [pollMs, setPollMs] = useState<number | undefined>(undefined);
    const {
        data: downloadData,
        refetch: refetchDownloads,
    } = useDownloads({ refetchInterval: pollMs });
    const downloadJobs = useMemo(() => downloadData ?? [], [downloadData]);

    const startDownload = useStartDownload();
    const cancelDownload = useCancelDownload();
    const repoFiles = useRepoFiles();

    const [filePicker, setFilePicker] = useState<{
        kind: 'models' | 'datasets';
        id: string;
        files: { path: string; size: number }[];
    } | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    useEffect(() => {
        const running = downloadJobs.some(j => j.status === 'running');
        setPollMs(running ? 1500 : undefined);
    }, [downloadJobs]);

    /**
     * Open the file picker for a repository.
     *
     * A repository is many files -- weights, configs, tokenizers, several
     * quantisations -- and "download this model" is not a single action. The
     * list, with sizes, is what makes the choice possible.
     */
    const openFilePicker = async (kind: 'models' | 'datasets', id: string) => {
        setDownloadError(null);
        try {
            const listing = await repoFiles.mutate({ kind, id });
            if (!listing) {
                setDownloadError('The server returned no file list for that repository.');
                return;
            }
            setFilePicker({ kind, id, files: listing.files });
        } catch (err) {
            setDownloadError(err instanceof Error ? err.message : 'Could not list that repository.');
        }
    };

    const beginDownload = async (filePath: string) => {
        if (!filePicker) return;
        setDownloadError(null);
        try {
            await startDownload.mutate({ kind: filePicker.kind, repoId: filePicker.id, filePath });
            setFilePicker(null);
            await refetchDownloads();
            // Start polling straight away rather than waiting for the effect
            // to notice on the next render.
            setPollMs(1500);
        } catch (err) {
            // The server refuses for reasons a user can act on -- too big, no
            // room, already there -- so its message is shown rather than a
            // generic failure.
            setDownloadError(err instanceof Error ? err.message : 'The server refused the download.');
        }
    };

    const stopDownload = async (id: string) => {
        try {
            await cancelDownload.mutate(id);
            await refetchDownloads();
        } catch (err) {
            setDownloadError(err instanceof Error ? err.message : 'Could not cancel that download.');
        }
    };

    // The remote catalogue, served by /api/catalog over the Hugging Face Hub.
    // Searched on demand rather than on load: the Hub rate-limits anonymous
    // callers, and a page that queried it on mount would spend that budget on
    // people who never opened this tab.
    const modelCatalog = useCatalogSearch('models');
    const datasetCatalog = useCatalogSearch('datasets');
    const [modelResults, setModelResults] = useState<CatalogEntry[] | null>(null);
    const [datasetResults, setDatasetResults] = useState<CatalogEntry[] | null>(null);
    const [modelCatalogError, setModelCatalogError] = useState<string | null>(null);
    const [datasetCatalogError, setDatasetCatalogError] = useState<string | null>(null);

    const runCatalogSearch = async (kind: 'models' | 'datasets') => {
        const setResults = kind === 'models' ? setModelResults : setDatasetResults;
        const setError = kind === 'models' ? setModelCatalogError : setDatasetCatalogError;
        const search = kind === 'models' ? modelCatalog : datasetCatalog;
        const q = kind === 'models' ? modelSearch : datasetSearch;

        setError(null);
        try {
            const answer = await search.mutate({ q, limit: 25 });
            // A resolved call with no payload is not an empty result set --
            // the difference matters, so it is not rendered as "no matches".
            if (!answer) {
                setError('The server returned no result for the search.');
                return;
            }
            setResults(answer.results);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'The search failed.');
        }
    };

    // The local dataset store, served by /api/datasets. Distinct from the
    // HuggingFace catalogue further down the same tab, which is fixtures.
    const {
        data: storedDatasetsData,
        isLoading: storedDatasetsLoading,
        error: storedDatasetsError,
        refetch: refetchDatasets,
    } = useDatasets();
    const storedDatasets = useMemo(() => storedDatasetsData ?? [], [storedDatasetsData]);

    const createDataset = useCreateDataset();
    const deleteDataset = useDeleteDataset();
    const [dsName, setDsName] = useState('');
    const [dsType, setDsType] = useState<DatasetType>('custom');
    const [dsBody, setDsBody] = useState('');
    const [dsMessage, setDsMessage] = useState<{ text: string; isError: boolean } | null>(null);

    /**
     * Upload a pasted JSON array as a dataset.
     *
     * Parsed here so a malformed paste fails with a readable message rather
     * than as a 400 from the server. The array must be an array: a single
     * object is a common paste mistake and would otherwise be stored as a
     * one-record dataset without comment.
     */
    const handleCreateDataset = async () => {
        setDsMessage(null);

        let entries: unknown[];
        try {
            const parsed = JSON.parse(dsBody);
            if (!Array.isArray(parsed)) {
                throw new Error('Expected a JSON array of records.');
            }
            entries = parsed;
        } catch (err) {
            setDsMessage({
                text: err instanceof Error ? err.message : 'That is not valid JSON.',
                isError: true,
            });
            return;
        }

        try {
            const created = await createDataset.mutate({
                name: dsName,
                type: dsType,
                entries,
            });
            setDsMessage(
                created
                    ? {
                          text: `Stored ${created.entryCount.toLocaleString()} entries (${formatBytes(created.sizeBytes)}).`,
                          isError: false,
                      }
                    : { text: 'The server returned no result for the upload.', isError: true }
            );
            setDsName('');
            setDsBody('');
            await refetchDatasets();
        } catch (err) {
            setDsMessage({
                text: err instanceof Error ? err.message : 'The server rejected the dataset.',
                isError: true,
            });
        }
    };

    const handleDeleteDataset = async (id: string) => {
        try {
            await deleteDataset.mutate(id);
            await refetchDatasets();
        } catch (err) {
            setDsMessage({
                text: err instanceof Error ? err.message : 'The dataset could not be deleted.',
                isError: true,
            });
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

    const tabs = [
        { id: 'models' as Tab, label: 'Models', icon: Box },
        { id: 'datasets' as Tab, label: 'Datasets', icon: Database },
        { id: 'training' as Tab, label: 'Training', icon: Zap },
        { id: 'rag' as Tab, label: 'RAG', icon: BookOpen },
        { id: 'tools' as Tab, label: 'Tool Use', icon: Wrench },
    ];

    return (
        <div className="space-y-6">

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

            {/* Stats Cards
              *
              * Three, where there were six. The three that went:
              *
              *   Models      counted a fixture list of eight, and reported how
              *               many of them were "downloaded" -- a flag on a
              *               literal. The catalogue is a search now and has no
              *               standing count to show.
              *   Storage     read "24.8 GB of 500 GB". Chasm measures neither
              *               number and has no notion of a quota.
              *   GPU         read "87%" on an "RTX 4090". Chasm does not look
              *               at the GPU, and there may not be one.
              *
              * Training Jobs went with them: it counted a fixture list. The
              * Training tab is served now, but its jobs are a queue rather
              * than a standing total, so there is nothing here to count.
              */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        <Database size={18} />
                        <span className="text-sm">Datasets</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{storedDatasets.length}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        {formatBytes(storedDatasets.reduce((sum, d) => sum + d.sizeBytes, 0))} stored
                    </p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <BookOpen size={18} />
                        <span className="text-sm">Documents</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{docs.length}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        {docs.reduce((sum, d) => sum + d.chunkCount, 0).toLocaleString()} chunks indexed
                    </p>
                </div>
            </div>

            {downloadError && (
                <div className="bg-[hsl(var(--card))] rounded-xl border border-red-500/40 p-4 text-sm text-[hsl(var(--muted-foreground))]">
                    {downloadError}
                </div>
            )}

            {/* Downloads
              *
              * Shown on every tab, because a transfer started from Models is
              * still running when the user walks over to Datasets, and a
              * progress bar that vanishes when you navigate away is the same
              * as no progress bar.
              *
              * Only rendered when there is something to say -- an empty panel
              * on every tab would be noise.
              */}
            {downloadJobs.length > 0 && (
                <div className="bg-[hsl(var(--card))] rounded-xl border">
                    <div className="p-4 border-b">
                        <h3 className="font-semibold text-[hsl(var(--foreground))]">Downloads</h3>
                    </div>
                    <div className="divide-y divide-[hsl(var(--border))]">
                        {downloadJobs.map(job => {
                            const pct = job.totalBytes > 0
                                ? Math.min(100, Math.round((job.downloadedBytes / job.totalBytes) * 100))
                                : 0;
                            return (
                                <div key={job.id} className="p-4 space-y-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-medium text-[hsl(var(--foreground))] break-words">
                                                {job.repoId} · {job.filePath}
                                            </p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] break-all">
                                                {job.destPath}
                                            </p>
                                        </div>
                                        <button
                                            className="p-2 rounded hover:bg-[hsl(var(--muted))] shrink-0"
                                            onClick={() => stopDownload(job.id)}
                                            title={job.status === 'running' ? 'Cancel this download' : 'Remove this record (the file is kept)'}
                                        >
                                            {job.status === 'running'
                                                ? <XCircle size={16} className="text-[hsl(var(--muted-foreground))]" />
                                                : <Trash2 size={16} className="text-red-500" />}
                                        </button>
                                    </div>

                                    {job.status === 'running' && (
                                        <div className="space-y-1">
                                            <div className="h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[hsl(var(--primary))] transition-all"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                {formatBytes(job.downloadedBytes)} of {formatBytes(job.totalBytes)} · {pct}%
                                            </p>
                                        </div>
                                    )}

                                    {job.status === 'completed' && (
                                        <p className="text-xs text-green-500">
                                            Complete · {formatBytes(job.totalBytes)}
                                        </p>
                                    )}
                                    {job.status === 'cancelled' && (
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                            Cancelled after {formatBytes(job.downloadedBytes)}. The partial file was removed.
                                        </p>
                                    )}
                                    {job.status === 'failed' && (
                                        <p className="text-xs text-red-500">{job.error ?? 'Failed.'}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* File picker
              *
              * A repository is many files -- weights, configs, tokenizers,
              * several quantisations of the same model -- so "download this
              * model" is not one action. Sizes come from the Hub and are shown
              * before anything starts, because the difference between a 665-byte
              * config and a 5 GB weight file is the whole decision.
              */}
            {filePicker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-[hsl(var(--card))] rounded-xl border w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="p-4 border-b flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="font-semibold text-[hsl(var(--foreground))] break-words">
                                    {filePicker.id}
                                </h3>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    {filePicker.files.length} file{filePicker.files.length === 1 ? '' : 's'}
                                </p>
                            </div>
                            <button
                                className="p-2 rounded hover:bg-[hsl(var(--muted))]"
                                onClick={() => setFilePicker(null)}
                            >
                                <XCircle size={18} className="text-[hsl(var(--muted-foreground))]" />
                            </button>
                        </div>
                        <div className="overflow-y-auto divide-y divide-[hsl(var(--border))]">
                            {filePicker.files.map(file => (
                                <div key={file.path} className="flex items-center justify-between gap-3 p-3">
                                    <div className="min-w-0">
                                        <p className="text-sm text-[hsl(var(--foreground))] break-all">{file.path}</p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                            {formatBytes(file.size)}
                                        </p>
                                    </div>
                                    <button
                                        className="px-3 py-1.5 shrink-0 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
                                        onClick={() => beginDownload(file.path)}
                                        disabled={startDownload.isLoading}
                                    >
                                        Download
                                    </button>
                                </div>
                            ))}
                        </div>
                        <p className="p-3 text-xs text-[hsl(var(--muted-foreground))] border-t">
                            Files are written on the server, beside its database unless
                            CHASM_DOWNLOAD_DIR says otherwise. A file that would not leave 2 GB free
                            is refused rather than filling the volume.
                        </p>
                    </div>
                </div>
            )}

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
            {/* Models Tab
              *
              * Served by /api/catalog/models, which proxies the Hugging Face
              * Hub's public search.
              *
              * The eight models listed here before were fixtures, each with a
              * size ("6.4 GB"), a parameter count ("3B"), a format ("GGUF")
              * and a `downloaded` flag. The Hub's search API reports none of
              * those four, so they are gone rather than derived from the name
              * or guessed from the tags. What is shown is what the Hub
              * publishes.
              *
              * Download stays disabled: nothing writes a file, and a button
              * that looked like it started one would be the defect this page
              * has been audited for.
              */}
            {activeTab === 'models' && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                            <input
                                type="text"
                                placeholder="Search the Hugging Face Hub..."
                                value={modelSearch}
                                onChange={(e) => setModelSearch(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') runCatalogSearch('models'); }}
                                className="w-full pl-10 pr-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            />
                        </div>
                        <button
                            className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 disabled:opacity-50"
                            onClick={() => runCatalogSearch('models')}
                            disabled={modelCatalog.isLoading}
                        >
                            {modelCatalog.isLoading ? 'Searching…' : 'Search'}
                        </button>
                    </div>

                    {modelCatalogError && (
                        <div className="bg-[hsl(var(--card))] rounded-xl border border-red-500/40 p-4 text-sm text-[hsl(var(--muted-foreground))]">
                            {modelCatalogError}
                        </div>
                    )}

                    {modelResults === null && !modelCatalogError && (
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            Search the Hub to list models. Nothing is queried until you ask — the Hub
                            rate-limits anonymous callers.
                        </p>
                    )}

                    {modelResults !== null && modelResults.length === 0 && (
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            The Hub returned no models for that search.
                        </p>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {(modelResults ?? []).map(model => (
                            <div key={model.id} className="bg-[hsl(var(--card))] rounded-xl border p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="w-12 h-12 shrink-0 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                            {model.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <a
                                                href={model.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="font-semibold text-[hsl(var(--foreground))] hover:underline break-words"
                                            >
                                                {model.name}
                                            </a>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                {model.author ?? 'Hugging Face'}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                                                <span>{compactCount(model.downloads)} downloads</span>
                                                <span>{compactCount(model.likes)} likes</span>
                                                {model.library && <span>{model.library}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => openFilePicker('models', model.id)}
                                        disabled={repoFiles.isLoading}
                                        title="Choose a file from this repository to download"
                                        className="flex items-center gap-1 px-3 py-1.5 shrink-0 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg text-sm hover:bg-[hsl(var(--muted))]/70 disabled:opacity-50"
                                    >
                                        <Download size={14} />
                                        Files
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                    {model.task && (
                                        <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-500 rounded-full">
                                            {model.task}
                                        </span>
                                    )}
                                    {model.gated && (
                                        <span className="text-xs px-2 py-1 bg-amber-500/10 text-amber-500 rounded-full">
                                            gated
                                        </span>
                                    )}
                                    {model.tags.slice(0, 4).map(tag => (
                                        <span key={tag} className="text-xs px-2 py-1 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-full">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-center">
                        <a
                            href="https://huggingface.co/models"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-4 py-2 text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] rounded-lg transition-colors"
                        >
                            Browse the Hugging Face Hub
                            <ExternalLink size={16} />
                        </a>
                    </div>
                </div>
            )}

            {/* Datasets Tab
              *
              * Two things share this word and they are not the same feature.
              *
              * "Your datasets" is the local store behind /api/datasets:
              * collections uploaded to this server. It is real.
              *
              * "Catalogue" below is remote HuggingFace artifacts you would
              * download *from*. The data flows the other way, nothing here
              * fetches it, and the rows are fixtures -- so they are kept
              * visibly apart rather than merged into one table that would be
              * half real.
              */}
            {activeTab === 'datasets' && (
                <div className="space-y-8">
                    {/* ---- Local store: real ---- */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">Your Datasets</h3>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                Stored on this server. Entry counts and sizes are measured from what was
                                actually written, not from what the upload claimed.
                            </p>
                        </div>

                        {storedDatasetsError && (
                            <div className="bg-[hsl(var(--card))] rounded-xl border border-red-500/40 p-4 text-sm text-[hsl(var(--muted-foreground))]">
                                Could not load datasets: {storedDatasetsError.message}
                            </div>
                        )}

                        <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                            {!storedDatasetsLoading && storedDatasets.length === 0 ? (
                                <p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">
                                    Nothing uploaded yet.
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b bg-[hsl(var(--muted))]/50">
                                                <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Dataset</th>
                                                <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Type</th>
                                                <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Entries</th>
                                                <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Stored</th>
                                                <th className="text-right px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {storedDatasets.map(dataset => (
                                                <tr key={dataset.id} className="border-b last:border-b-0 hover:bg-[hsl(var(--muted))]/30">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <Database size={16} className="text-[hsl(var(--muted-foreground))]" />
                                                            <span className="font-medium text-[hsl(var(--foreground))]">{dataset.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">{dataset.type}</td>
                                                    <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                                                        {dataset.entryCount.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                                                        {formatBytes(dataset.sizeBytes)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            className="p-2 rounded hover:bg-[hsl(var(--muted))]"
                                                            onClick={() => handleDeleteDataset(dataset.id)}
                                                            title="Delete this dataset and its entries"
                                                        >
                                                            <Trash2 size={16} className="text-red-500" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Upload */}
                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6 space-y-4">
                            <h4 className="font-semibold text-[hsl(var(--foreground))]">Upload</h4>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    className="flex-1 px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]"
                                    placeholder="Dataset name"
                                    value={dsName}
                                    onChange={e => setDsName(e.target.value)}
                                />
                                <select
                                    className="px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]"
                                    value={dsType}
                                    onChange={e => setDsType(e.target.value as DatasetType)}
                                >
                                    {DATASET_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            <textarea
                                className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] font-mono text-sm h-40 resize-none"
                                placeholder='[{"prompt": "...", "completion": "..."}]'
                                value={dsBody}
                                onChange={e => setDsBody(e.target.value)}
                            />
                            <div className="flex items-center gap-3">
                                <button
                                    className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
                                    onClick={handleCreateDataset}
                                    disabled={!dsName.trim() || !dsBody.trim() || createDataset.isLoading}
                                >
                                    <Upload size={16} />
                                    {createDataset.isLoading ? 'Uploading…' : 'Upload'}
                                </button>
                                {dsMessage && (
                                    <span className={`text-sm ${dsMessage.isError ? 'text-red-500' : 'text-green-500'}`}>
                                        {dsMessage.text}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                A JSON array of records, at most 50,000 per upload — the server parses the
                                body into memory and has no streaming import.
                            </p>
                        </div>
                    </div>

                    {/* ---- Remote catalogue: served by /api/catalog ---- */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">Catalogue</h3>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                Datasets published on the Hugging Face Hub. A different feature from the
                                store above — these live elsewhere and the data would flow the other way.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative flex-1 max-w-md">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                                <input
                                    type="text"
                                    placeholder="Search the Hugging Face Hub..."
                                    value={datasetSearch}
                                    onChange={(e) => setDatasetSearch(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') runCatalogSearch('datasets'); }}
                                    className="w-full pl-10 pr-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                />
                            </div>
                            <button
                                className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 disabled:opacity-50"
                                onClick={() => runCatalogSearch('datasets')}
                                disabled={datasetCatalog.isLoading}
                            >
                                {datasetCatalog.isLoading ? 'Searching…' : 'Search'}
                            </button>
                        </div>

                        {datasetCatalogError && (
                            <div className="bg-[hsl(var(--card))] rounded-xl border border-red-500/40 p-4 text-sm text-[hsl(var(--muted-foreground))]">
                                {datasetCatalogError}
                            </div>
                        )}

                        {datasetResults === null && !datasetCatalogError && (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                Search the Hub to list datasets. Nothing is queried until you ask.
                            </p>
                        )}

                        {datasetResults !== null && datasetResults.length === 0 && (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                The Hub returned no datasets for that search.
                            </p>
                        )}

                        {datasetResults !== null && datasetResults.length > 0 && (
                            <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b bg-[hsl(var(--muted))]/50">
                                                <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Dataset</th>
                                                <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Author</th>
                                                <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Downloads</th>
                                                <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Likes</th>
                                                <th className="text-left px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Updated</th>
                                                <th className="text-right px-4 py-3 text-sm font-medium text-[hsl(var(--muted-foreground))]">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {datasetResults.map(entry => (
                                                <tr key={entry.id} className="border-b last:border-b-0 hover:bg-[hsl(var(--muted))]/30">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <Database size={16} className="text-[hsl(var(--muted-foreground))] shrink-0" />
                                                            <a
                                                                href={entry.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="font-medium text-[hsl(var(--foreground))] hover:underline"
                                                            >
                                                                {entry.name}
                                                            </a>
                                                            {entry.gated && (
                                                                <span className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-full">
                                                                    gated
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                                                        {entry.author ?? '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                                                        {compactCount(entry.downloads)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                                                        {compactCount(entry.likes)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
                                                        {entry.updatedAt ? entry.updatedAt.slice(0, 10) : '—'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={() => openFilePicker('datasets', entry.id)}
                                                            disabled={repoFiles.isLoading}
                                                            title="Choose a file from this repository to download"
                                                            className="flex items-center gap-1 px-3 py-1 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded text-sm hover:bg-[hsl(var(--muted))]/70 disabled:opacity-50 ml-auto"
                                                        >
                                                            <FileDown size={14} />
                                                            Files
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            Size, sample count and format are not shown because the Hub&apos;s search API
                            does not report them. Files lists what a repository holds, with the sizes
                            the Hub does report, so a download can be chosen knowingly.
                        </p>
                    </div>
                </div>
            )}

            {/* Training Tab
              *
              * Served by /api/training, which submits a stored dataset to the
              * provider configured on the server. Chasm does not train
              * anything and does not claim to.
              *
              * There is no progress bar. The four jobs listed here before were
              * fixtures showing 67% and 34% complete with ETAs and an
              * "RTX 4090" -- a fine-tuning API reports a status, and once
              * finished a token count and the resulting model's name. It
              * reports no percentage, no ETA, no GPU and no accuracy, so none
              * are shown. A bar needs a fraction, and the only way to draw one
              * here would be to make it up.
              *
              * The loss chart went with them: it plotted `trainingMetrics`,
              * six hand-written epochs of loss and validation loss for a run
              * that never happened.
              */}
            {activeTab === 'training' && (
                <div className="space-y-6">
                    {/* Submit */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-6 space-y-4">
                        <div>
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">Fine-tune a Model</h3>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                Chasm hands one of your datasets to the provider configured on the server
                                and reports what that provider says. It does not train anything itself.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <select
                                className="flex-1 px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]"
                                value={trainDatasetId}
                                onChange={e => setTrainDatasetId(e.target.value)}
                            >
                                <option value="">Choose a dataset…</option>
                                {storedDatasets.map(d => (
                                    <option key={d.id} value={d.id}>
                                        {d.name} ({d.entryCount.toLocaleString()} entries)
                                    </option>
                                ))}
                            </select>
                            <input
                                className="flex-1 px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]"
                                placeholder="Base model"
                                value={trainBaseModel}
                                onChange={e => setTrainBaseModel(e.target.value)}
                            />
                            <input
                                className="sm:w-40 px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]"
                                placeholder="Suffix (optional)"
                                value={trainSuffix}
                                onChange={e => setTrainSuffix(e.target.value)}
                            />
                        </div>

                        {storedDatasets.length === 0 && (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                No datasets yet — upload one on the Datasets tab first.
                            </p>
                        )}

                        <div className="flex items-center gap-3 flex-wrap">
                            <button
                                className="px-4 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg hover:bg-[hsl(var(--muted))]/70 disabled:opacity-50"
                                onClick={runValidation}
                                disabled={!trainDatasetId || validateDataset.isLoading}
                            >
                                {validateDataset.isLoading ? 'Checking…' : 'Check dataset'}
                            </button>
                            <button
                                className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 disabled:opacity-50"
                                onClick={submitTraining}
                                disabled={!trainDatasetId || !trainBaseModel.trim() || startTraining.isLoading}
                            >
                                {startTraining.isLoading ? 'Submitting…' : 'Start fine-tune'}
                            </button>
                            {trainMessage && (
                                <span className={`text-sm ${trainMessage.isError ? 'text-red-500' : 'text-green-500'}`}>
                                    {trainMessage.text}
                                </span>
                            )}
                        </div>

                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            Checking is free and runs here. Submitting uploads the dataset to your provider
                            and starts a job you will be billed for — so the same checks run first, and a
                            dataset that would fail is refused before anything is uploaded.
                        </p>

                        {validation && (
                            <div className={`rounded-lg border p-4 text-sm ${validation.usable ? 'border-green-500/40' : 'border-amber-500/40'}`}>
                                <p className={validation.usable ? 'text-green-500' : 'text-amber-500'}>
                                    {validation.usable
                                        ? `${validation.datasetName} is ready: ${validation.entryCount.toLocaleString()} examples, no problems found.`
                                        : `${validation.datasetName} has ${validation.problems.length} problem${validation.problems.length === 1 ? '' : 's'}.`}
                                </p>
                                {validation.problems.length > 0 && (
                                    <ul className="mt-2 space-y-1 text-[hsl(var(--muted-foreground))]">
                                        {validation.problems.map((problem, i) => (
                                            <li key={i}>
                                                {problem.entryIndex !== undefined && (
                                                    <span className="font-mono text-xs mr-2">entry {problem.entryIndex}</span>
                                                )}
                                                {problem.message}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Jobs */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border">
                        <div className="p-4 border-b">
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">Jobs</h3>
                        </div>

                        {trainingListError && (
                            <p className="p-4 text-sm text-red-500">{trainingListError.message}</p>
                        )}

                        {!trainingListError && trainingJobs.length === 0 && (
                            <p className="p-4 text-sm text-[hsl(var(--muted-foreground))]">
                                No fine-tuning jobs yet.
                            </p>
                        )}

                        <div className="divide-y divide-[hsl(var(--border))]">
                            {trainingJobs.map(job => (
                                <div key={job.id} className="p-4 space-y-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-medium text-[hsl(var(--foreground))] break-words">
                                                {job.datasetName} → {job.baseModel}
                                            </p>
                                            <p className="text-xs font-mono text-[hsl(var(--muted-foreground))] break-all">
                                                {job.providerJobId}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                                job.status === 'succeeded' ? 'bg-green-500/10 text-green-500'
                                                : job.status === 'failed' ? 'bg-red-500/10 text-red-500'
                                                : job.status === 'cancelled' ? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                                                : 'bg-blue-500/10 text-blue-500'
                                            }`}>
                                                {job.status}
                                            </span>
                                            <button
                                                className="p-2 rounded hover:bg-[hsl(var(--muted))]"
                                                onClick={() => stopTraining(job.id)}
                                                title={
                                                    ['succeeded', 'failed', 'cancelled'].includes(job.status)
                                                        ? 'Remove this record'
                                                        : 'Cancel this job at the provider'
                                                }
                                            >
                                                {['succeeded', 'failed', 'cancelled'].includes(job.status)
                                                    ? <Trash2 size={16} className="text-red-500" />
                                                    : <XCircle size={16} className="text-[hsl(var(--muted-foreground))]" />}
                                            </button>
                                        </div>
                                    </div>

                                    {job.fineTunedModel && (
                                        <p className="text-sm text-[hsl(var(--foreground))]">
                                            <span className="text-[hsl(var(--muted-foreground))]">Model: </span>
                                            <code className="font-mono text-xs">{job.fineTunedModel}</code>
                                            {job.trainedTokens !== undefined && (
                                                <span className="text-[hsl(var(--muted-foreground))]">
                                                    {' '}· {job.trainedTokens.toLocaleString()} tokens trained
                                                </span>
                                            )}
                                        </p>
                                    )}

                                    {job.error && <p className="text-sm text-red-500">{job.error}</p>}

                                    {/* Shown because a stale status looks exactly like a current one. */}
                                    {job.refreshError && (
                                        <p className="text-xs text-amber-500">
                                            Last known status — could not reach the provider: {job.refreshError}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

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

        </div>
    );
};