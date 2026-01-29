/**
 * TemplatePicker Component
 *
 * Provides UI for selecting and managing session templates including
 * built-in templates and custom user templates.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type {
    SessionTemplate,
    TemplateMessage,
    ModelParameters,
    TemplateCategory,
} from '@csm/shared';
import { TEMPLATE_CATEGORIES, BUILTIN_TEMPLATES } from '@csm/shared';

// =============================================================================
// Template Card Component
// =============================================================================

interface TemplateCardProps {
    template: SessionTemplate;
    isSelected?: boolean;
    onSelect: (template: SessionTemplate) => void;
    onEdit?: (template: SessionTemplate) => void;
    onDelete?: (templateId: string) => void;
    onDuplicate?: (template: SessionTemplate) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
    template,
    isSelected,
    onSelect,
    onEdit,
    onDelete,
    onDuplicate,
}) => {
    const categoryLabel = TEMPLATE_CATEGORIES.find((c) => c.id === template.category)?.name || template.category;

    return (
        <div
            className={`template-card ${isSelected ? 'selected' : ''} ${template.isBuiltIn ? 'builtin' : 'custom'}`}
            onClick={() => onSelect(template)}
        >
            <div className="template-card-header">
                <span className="template-icon">{template.icon || '📝'}</span>
                <div className="template-info">
                    <h4 className="template-name">{template.name}</h4>
                    <span className="template-category">{categoryLabel}</span>
                </div>
                {template.isBuiltIn && <span className="builtin-badge">Built-in</span>}
            </div>

            <p className="template-description">{template.description || 'No description'}</p>

            <div className="template-meta">
                <span className="message-count">
                    {(template.initialMessages?.length || 0)} message{(template.initialMessages?.length || 0) !== 1 ? 's' : ''}
                </span>
                {template.preferredModel && (
                    <span className="model-info">
                        {template.preferredModel}
                    </span>
                )}
            </div>

            <div className="template-actions">
                <button
                    className="btn-icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(template);
                    }}
                    title="Use template"
                >
                    ▶️
                </button>
                {onDuplicate && (
                    <button
                        className="btn-icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDuplicate(template);
                        }}
                        title="Duplicate"
                    >
                        📋
                    </button>
                )}
                {!template.isBuiltIn && onEdit && (
                    <button
                        className="btn-icon"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(template);
                        }}
                        title="Edit"
                    >
                        ✏️
                    </button>
                )}
                {!template.isBuiltIn && onDelete && (
                    <button
                        className="btn-icon danger"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(template.id);
                        }}
                        title="Delete"
                    >
                        🗑️
                    </button>
                )}
            </div>
        </div>
    );
};

// =============================================================================
// Template Editor Component
// =============================================================================

interface TemplateEditorProps {
    template?: SessionTemplate;
    onSave: (template: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => void;
    onCancel: () => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
    template,
    onSave,
    onCancel,
}) => {
    const [name, setName] = useState(template?.name || '');
    const [description, setDescription] = useState(template?.description || '');
    const [category, setCategory] = useState<TemplateCategory>(template?.category || 'coding');
    const [icon, setIcon] = useState(template?.icon || '📝');
    const [systemPrompt, setSystemPrompt] = useState(template?.systemPrompt || '');
    const [messages, setMessages] = useState<TemplateMessage[]>(template?.initialMessages || []);
    const [modelParameters, setModelParameters] = useState<ModelParameters>(
        template?.parameters || { temperature: 0.7, maxTokens: 4096 }
    );

    const handleAddMessage = useCallback(() => {
        const newMessage: TemplateMessage = {
            role: 'user',
            content: '',
            placeholder: true,
        };
        setMessages([...messages, newMessage]);
    }, [messages]);

    const handleUpdateMessage = useCallback((index: number, updates: Partial<TemplateMessage>) => {
        setMessages(messages.map((msg, i) => (i === index ? { ...msg, ...updates } : msg)));
    }, [messages]);

    const handleRemoveMessage = useCallback((index: number) => {
        setMessages(messages.filter((_, i) => i !== index));
    }, [messages]);

    const handleMoveMessage = useCallback((index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= messages.length) return;

        const newMessages = [...messages];
        [newMessages[index], newMessages[newIndex]] = [newMessages[newIndex], newMessages[index]];
        setMessages(newMessages);
    }, [messages]);

    const handleSave = useCallback(() => {
        if (!name.trim()) return;

        const savedTemplate: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'> = {
            name: name.trim(),
            description: description.trim(),
            category,
            icon,
            systemPrompt,
            initialMessages: messages,
            parameters: modelParameters,
            tags: template?.tags || [],
            isBuiltIn: false,
        };

        onSave(savedTemplate);
    }, [name, description, category, icon, systemPrompt, messages, modelParameters, template, onSave]);

    const isValid = name.trim().length > 0;

    const ICONS = ['📝', '🐛', '📚', '🔄', '🧪', '📖', '🔌', '💾', '⚙️', '🎨', '🚀', '💡', '🔍', '📊', '🛠️'];

    return (
        <div className="template-editor">
            <div className="template-editor-header">
                <h3>{template ? 'Edit Template' : 'Create Template'}</h3>
                <button className="btn-icon" onClick={onCancel} title="Cancel">
                    ×
                </button>
            </div>

            <div className="template-editor-form">
                <div className="form-group">
                    <label>Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Template name"
                        className="form-input"
                    />
                </div>

                <div className="form-group">
                    <label>Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What does this template do?"
                        rows={2}
                        className="form-textarea"
                    />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>Category</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                            className="form-select"
                        >
                            {TEMPLATE_CATEGORIES.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Icon</label>
                        <div className="icon-picker">
                            {ICONS.map((i) => (
                                <button
                                    key={i}
                                    className={`icon-option ${icon === i ? 'selected' : ''}`}
                                    onClick={() => setIcon(i)}
                                >
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label>System Prompt</label>
                    <textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="System instructions for the AI..."
                        rows={4}
                        className="form-textarea"
                    />
                </div>

                <div className="form-group">
                    <label>Model Parameters</label>
                    <div className="model-params">
                        <div className="param">
                            <label>Temperature: {modelParameters.temperature}</label>
                            <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={modelParameters.temperature || 0.7}
                                onChange={(e) => setModelParameters({ ...modelParameters, temperature: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="param">
                            <label>Max Tokens</label>
                            <input
                                type="number"
                                value={modelParameters.maxTokens || 4096}
                                onChange={(e) => setModelParameters({ ...modelParameters, maxTokens: parseInt(e.target.value) || 4096 })}
                                className="form-input"
                            />
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <div className="messages-header">
                        <label>Initial Messages</label>
                        <button className="btn-secondary btn-sm" onClick={handleAddMessage}>
                            + Add Message
                        </button>
                    </div>

                    <div className="messages-list">
                        {messages.map((message, index) => (
                            <div key={index} className="message-editor">
                                <div className="message-controls">
                                    <select
                                        value={message.role}
                                        onChange={(e) => handleUpdateMessage(index, { role: e.target.value as 'system' | 'user' | 'assistant' })}
                                        className="form-select role-select"
                                    >
                                        <option value="system">System</option>
                                        <option value="user">User</option>
                                        <option value="assistant">Assistant</option>
                                    </select>

                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={message.placeholder || false}
                                            onChange={(e) => handleUpdateMessage(index, { placeholder: e.target.checked })}
                                        />
                                        Placeholder
                                    </label>

                                    <div className="message-actions">
                                        <button
                                            className="btn-icon"
                                            onClick={() => handleMoveMessage(index, 'up')}
                                            disabled={index === 0}
                                            title="Move up"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            className="btn-icon"
                                            onClick={() => handleMoveMessage(index, 'down')}
                                            disabled={index === messages.length - 1}
                                            title="Move down"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            className="btn-icon danger"
                                            onClick={() => handleRemoveMessage(index)}
                                            title="Remove"
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>

                                <textarea
                                    value={message.content}
                                    onChange={(e) => handleUpdateMessage(index, { content: e.target.value })}
                                    placeholder={message.placeholder ? 'Default content (optional)' : 'Message content'}
                                    rows={3}
                                    className="form-textarea"
                                />
                            </div>
                        ))}

                        {messages.length === 0 && (
                            <div className="empty-state">
                                No messages yet. Add messages to define the conversation flow.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="template-editor-footer">
                <button className="btn-secondary" onClick={onCancel}>
                    Cancel
                </button>
                <button className="btn-primary" onClick={handleSave} disabled={!isValid}>
                    {template ? 'Save Changes' : 'Create Template'}
                </button>
            </div>
        </div>
    );
};

// =============================================================================
// Main Template Picker Component
// =============================================================================

interface TemplatePickerProps {
    customTemplates: SessionTemplate[];
    selectedTemplateId?: string;
    onCreateTemplate: (template: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => void;
    onUpdateTemplate: (template: SessionTemplate) => void;
    onDeleteTemplate: (templateId: string) => void;
    onUseTemplate: (template: SessionTemplate) => void;
}

// Helper to convert builtin template to full SessionTemplate
function toFullTemplate(builtin: typeof BUILTIN_TEMPLATES[number]): SessionTemplate {
    const now = new Date().toISOString();
    return {
        ...builtin,
        id: `builtin-${builtin.name.toLowerCase().replace(/\s+/g, '-')}`,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
    };
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({
    customTemplates,
    selectedTemplateId,
    onCreateTemplate,
    onUpdateTemplate,
    onDeleteTemplate,
    onUseTemplate,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
    const [showBuiltin, setShowBuiltin] = useState(true);
    const [showCustom, setShowCustom] = useState(true);
    const [editingTemplate, setEditingTemplate] = useState<SessionTemplate | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Convert built-in templates
    const builtinTemplates = useMemo(() => BUILTIN_TEMPLATES.map(toFullTemplate), []);

    // Combine built-in and custom templates
    const allTemplates = useMemo(() => {
        const templates: SessionTemplate[] = [];
        if (showBuiltin) {
            templates.push(...builtinTemplates);
        }
        if (showCustom) {
            templates.push(...customTemplates);
        }
        return templates;
    }, [customTemplates, showBuiltin, showCustom, builtinTemplates]);

    // Filter templates
    const filteredTemplates = useMemo(() => {
        return allTemplates.filter((template) => {
            // Category filter
            if (selectedCategory !== 'all' && template.category !== selectedCategory) {
                return false;
            }

            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    template.name.toLowerCase().includes(query) ||
                    (template.description?.toLowerCase().includes(query) || false) ||
                    template.tags?.some((tag) => tag.toLowerCase().includes(query))
                );
            }

            return true;
        });
    }, [allTemplates, selectedCategory, searchQuery]);

    // Group templates by category
    const groupedTemplates = useMemo(() => {
        const groups: Record<string, SessionTemplate[]> = {};
        filteredTemplates.forEach((template) => {
            const category = template.category;
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(template);
        });
        return groups;
    }, [filteredTemplates]);

    const handleDuplicate = useCallback((template: SessionTemplate) => {
        const duplicate: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'> = {
            name: `${template.name} (Copy)`,
            description: template.description,
            category: template.category,
            systemPrompt: template.systemPrompt,
            initialMessages: template.initialMessages,
            suggestedQueries: template.suggestedQueries,
            preferredProvider: template.preferredProvider,
            preferredModel: template.preferredModel,
            parameters: template.parameters,
            tags: template.tags,
            icon: template.icon,
            color: template.color,
            isBuiltIn: false,
        };
        onCreateTemplate(duplicate);
    }, [onCreateTemplate]);

    const handleSaveTemplate = useCallback((template: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
        if (isCreating) {
            onCreateTemplate(template);
            setIsCreating(false);
        } else if (editingTemplate) {
            onUpdateTemplate({
                ...editingTemplate,
                ...template,
                updatedAt: new Date().toISOString(),
            });
            setEditingTemplate(null);
        }
    }, [isCreating, editingTemplate, onCreateTemplate, onUpdateTemplate]);

    const handleCancelEdit = useCallback(() => {
        setEditingTemplate(null);
        setIsCreating(false);
    }, []);

    // Show editor if creating or editing
    if (isCreating || editingTemplate) {
        return (
            <TemplateEditor
                template={editingTemplate || undefined}
                onSave={handleSaveTemplate}
                onCancel={handleCancelEdit}
            />
        );
    }

    return (
        <div className="template-picker">
            <div className="template-picker-header">
                <h3>Session Templates</h3>
                <button
                    className="btn-primary"
                    onClick={() => setIsCreating(true)}
                >
                    + New Template
                </button>
            </div>

            <div className="template-picker-filters">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search templates..."
                    className="search-input"
                />

                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as TemplateCategory | 'all')}
                    className="form-select"
                >
                    <option value="all">All Categories</option>
                    {TEMPLATE_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                            {cat.name}
                        </option>
                    ))}
                </select>

                <div className="filter-toggles">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={showBuiltin}
                            onChange={(e) => setShowBuiltin(e.target.checked)}
                        />
                        Built-in
                    </label>
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={showCustom}
                            onChange={(e) => setShowCustom(e.target.checked)}
                        />
                        Custom
                    </label>
                </div>
            </div>

            <div className="template-picker-content">
                {Object.entries(groupedTemplates).map(([category, templates]) => {
                    const categoryInfo = TEMPLATE_CATEGORIES.find((c) => c.id === category);
                    return (
                        <div key={category} className="template-category-group">
                            <h4 className="category-header">
                                {categoryInfo?.name || category}
                                <span className="template-count">{templates.length}</span>
                            </h4>
                            <div className="templates-grid">
                                {templates.map((template) => (
                                    <TemplateCard
                                        key={template.id}
                                        template={template}
                                        isSelected={template.id === selectedTemplateId}
                                        onSelect={onUseTemplate}
                                        onEdit={!template.isBuiltIn ? setEditingTemplate : undefined}
                                        onDelete={!template.isBuiltIn ? onDeleteTemplate : undefined}
                                        onDuplicate={handleDuplicate}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}

                {filteredTemplates.length === 0 && (
                    <div className="empty-state">
                        <p>No templates found</p>
                        {searchQuery && (
                            <button className="btn-secondary" onClick={() => setSearchQuery('')}>
                                Clear search
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TemplatePicker;
