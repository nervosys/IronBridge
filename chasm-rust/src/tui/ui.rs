// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! UI rendering for the TUI

use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Style, Stylize},
    text::{Line, Span, Text},
    widgets::{
        Block, Borders, Cell, Clear, List, ListItem, Paragraph, Row, Scrollbar,
        ScrollbarOrientation, ScrollbarState, Table, TableState, Wrap,
    },
    Frame,
};

use super::app::{App, AppMode, ExportFormat};
use crate::models::extract_response_text;

/// Color scheme for the TUI (Abyss dark theme — matching Remotion videos)
#[allow(dead_code)]
pub struct Colors;

#[allow(dead_code)]
impl Colors {
    // Background colors
    pub const BG: Color = Color::Rgb(10, 14, 20); // #0a0e14 deep abyss
    pub const HEADER_BG: Color = Color::Rgb(22, 27, 34); // #161b22 elevated surface

    // Selection colors
    pub const SELECTED_BG: Color = Color::Rgb(8, 36, 46); // rgba(0,212,255,0.12) over abyss
    pub const SELECTED_FG: Color = Color::Rgb(230, 237, 243); // #e6edf3 bright text on selection

    // Border colors
    pub const BORDER: Color = Color::Rgb(33, 38, 45); // #21262d subtle
    pub const BORDER_FOCUSED: Color = Color::Rgb(0, 212, 255); // #00d4ff primary cyan

    // Text colors
    pub const TEXT: Color = Color::Rgb(230, 237, 243); // #e6edf3 crisp
    pub const TEXT_DIM: Color = Color::Rgb(139, 148, 158); // #8b949e muted

    // Accent colors (Abyss palette)
    pub const ACCENT: Color = Color::Rgb(0, 212, 255); // #00d4ff primary cyan
    pub const SECONDARY: Color = Color::Rgb(124, 58, 237); // #7c3aed purple
    pub const TEAL: Color = Color::Rgb(0, 201, 167); // #00c9a7 accent teal
    pub const SUCCESS: Color = Color::Rgb(63, 185, 80); // #3fb950 green
    pub const WARNING: Color = Color::Rgb(210, 153, 34); // #d29922 amber
    pub const ERROR: Color = Color::Rgb(248, 81, 73); // #f85149 red
    pub const INFO: Color = Color::Rgb(0, 212, 255); // #00d4ff same as primary
    pub const PURPLE: Color = Color::Rgb(124, 58, 237); // #7c3aed same as secondary
}

/// Render the entire UI
pub fn render(frame: &mut Frame, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Header
            Constraint::Min(0),    // Main content
            Constraint::Length(3), // Footer/status
        ])
        .split(frame.area());

    render_header(frame, app, chunks[0]);
    render_main_content(frame, app, chunks[1]);
    render_footer(frame, app, chunks[2]);

    // Render overlays
    if app.mode == AppMode::Help {
        render_help_overlay(frame);
    }
    if app.export_picker_active {
        render_export_picker(frame, app);
    }
    if app.search_active {
        render_search_input(frame, app);
    }
    if app.confirm_delete {
        render_delete_confirm(frame);
    }
}

/// Render the header bar
fn render_header(frame: &mut Frame, app: &App, area: Rect) {
    let breadcrumb = app.breadcrumb();

    let stats = format!(
        "  {} workspaces · {} with chats · {} total sessions",
        app.workspaces.len(),
        app.workspaces_with_chats(),
        app.total_sessions()
    );

    let mut spans = vec![
        Span::styled(" ◆ Chasm TUI", Style::default().fg(Colors::ACCENT).bold()),
        Span::styled("  │  ", Style::default().fg(Colors::BORDER)),
        Span::styled(breadcrumb, Style::default().fg(Colors::TEXT)),
    ];

    // Show sort order in sessions view
    if app.mode == AppMode::Sessions {
        spans.push(Span::styled("  │  ", Style::default().fg(Colors::BORDER)));
        spans.push(Span::styled(
            format!("Sort: {}", app.sort_order.label()),
            Style::default().fg(Colors::TEXT_DIM),
        ));
    }

    // Show filter if active
    if !app.session_filter_query.is_empty() && app.mode == AppMode::Sessions {
        spans.push(Span::styled("  │  ", Style::default().fg(Colors::BORDER)));
        spans.push(Span::styled(
            format!("Filter: {}", app.session_filter_query),
            Style::default().fg(Colors::ACCENT),
        ));
    }

    // Stats at end
    spans.push(Span::styled(stats, Style::default().fg(Colors::TEXT_DIM)));

    let header = Paragraph::new(Line::from(spans)).block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Colors::BORDER))
            .style(Style::default().bg(Colors::HEADER_BG)),
    );

    frame.render_widget(header, area);
}

/// Render the main content area
fn render_main_content(frame: &mut Frame, app: &App, area: Rect) {
    match app.mode {
        AppMode::Workspaces => render_workspaces_view(frame, app, area),
        AppMode::Sessions => render_sessions_view(frame, app, area),
        AppMode::SessionDetail => render_session_detail_view(frame, app, area),
        AppMode::SearchResults => render_search_results(frame, app, area),
        AppMode::Help => render_workspaces_view(frame, app, area),
    }
}

/// Render the workspaces table view
fn render_workspaces_view(frame: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(60), Constraint::Percentage(40)])
        .split(area);

    // Left: Workspace table
    render_workspace_table(frame, app, chunks[0]);

    // Right: Session preview for selected workspace
    render_session_preview(frame, app, chunks[1]);
}

/// Render the workspace table
fn render_workspace_table(frame: &mut Frame, app: &App, area: Rect) {
    let header_cells = ["#", "Hash", "Project Path", "Sessions", "Status"]
        .iter()
        .map(|h| Cell::from(*h).style(Style::default().fg(Colors::ACCENT).bold()));

    let header = Row::new(header_cells)
        .style(Style::default().bg(Colors::HEADER_BG))
        .height(1);

    let rows: Vec<Row> = app
        .filtered_indices
        .iter()
        .enumerate()
        .map(|(display_idx, &actual_idx)| {
            let ws = &app.workspaces[actual_idx];
            let is_selected = display_idx == app.workspace_index;

            let hash = format!("{}...", &ws.hash[..8.min(ws.hash.len())]);
            let path = ws
                .project_path
                .clone()
                .unwrap_or_else(|| "(none)".to_string());
            let sessions = ws.chat_session_count.to_string();
            let status = if ws.has_chat_sessions { "[OK]" } else { "[-]" };

            let status_style = if ws.has_chat_sessions {
                Style::default().fg(Colors::TEAL)
            } else {
                Style::default().fg(Colors::TEXT_DIM)
            };

            let row_style = if is_selected {
                Style::default()
                    .bg(Colors::SELECTED_BG)
                    .fg(Colors::SELECTED_FG)
            } else {
                Style::default().fg(Colors::TEXT)
            };

            Row::new(vec![
                Cell::from(format!("{}", display_idx + 1)),
                Cell::from(hash).style(Style::default().fg(Colors::TEXT_DIM)),
                Cell::from(truncate_path(&path, 40)),
                Cell::from(sessions).style(Style::default().fg(Colors::INFO)),
                Cell::from(status).style(status_style),
            ])
            .style(row_style)
            .height(1)
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Length(5),
            Constraint::Length(12),
            Constraint::Min(20),
            Constraint::Length(10),
            Constraint::Length(8),
        ],
    )
    .header(header)
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Colors::BORDER_FOCUSED))
            .title(Span::styled(
                format!(
                    " Workspaces ({}/{}) ",
                    app.workspace_index + 1,
                    app.filtered_indices.len()
                ),
                Style::default().fg(Colors::ACCENT),
            )),
    )
    .row_highlight_style(Style::default().bg(Colors::SELECTED_BG))
    .highlight_symbol("▎ ");

    let mut state = TableState::default();
    state.select(Some(app.workspace_index));

    frame.render_stateful_widget(table, area, &mut state);
}

/// Render session preview panel
fn render_session_preview(frame: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Colors::BORDER))
        .title(Span::styled(
            " Sessions Preview ",
            Style::default().fg(Colors::ACCENT),
        ));

    if app.sessions.is_empty() {
        let text = Paragraph::new(Text::styled(
            "No sessions in this workspace",
            Style::default().fg(Colors::TEXT_DIM),
        ))
        .block(block);
        frame.render_widget(text, area);
        return;
    }

    let items: Vec<ListItem> = app
        .sessions
        .iter()
        .enumerate()
        .map(|(i, s)| {
            let title = s.session.title();
            let style = if i == app.session_index {
                Style::default().fg(Colors::SELECTED_FG).bold()
            } else {
                Style::default().fg(Colors::TEXT)
            };

            let content = Line::from(vec![
                Span::styled(
                    format!("{:2}. ", i + 1),
                    Style::default().fg(Colors::TEXT_DIM),
                ),
                Span::styled(truncate_string(&title, 30), style),
                Span::styled(
                    format!(" ({} msgs)", s.message_count),
                    Style::default().fg(Colors::INFO),
                ),
            ]);
            ListItem::new(content)
        })
        .collect();

    let list = List::new(items)
        .block(block)
        .highlight_style(Style::default().bg(Colors::SELECTED_BG));

    frame.render_widget(list, area);
}

/// Render the sessions view
fn render_sessions_view(frame: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area);

    // Left: Session list with details
    render_session_table(frame, app, chunks[0]);

    // Right: Message preview
    render_message_preview(frame, app, chunks[1]);
}

/// Render session table
fn render_session_table(frame: &mut Frame, app: &App, area: Rect) {
    let ws_name = app
        .current_workspace()
        .and_then(|ws| ws.project_path.as_ref())
        .map(|p| truncate_path(p, 30))
        .unwrap_or_else(|| "(none)".to_string());

    let header_cells = ["#", "Title", "Messages", "Modified"]
        .iter()
        .map(|h| Cell::from(*h).style(Style::default().fg(Colors::ACCENT).bold()));

    let header = Row::new(header_cells)
        .style(Style::default().bg(Colors::HEADER_BG))
        .height(1);

    let rows: Vec<Row> = app
        .sessions
        .iter()
        .enumerate()
        .map(|(i, s)| {
            let is_selected = i == app.session_index;
            let title = s.session.title();

            let row_style = if is_selected {
                Style::default()
                    .bg(Colors::SELECTED_BG)
                    .fg(Colors::SELECTED_FG)
            } else {
                Style::default().fg(Colors::TEXT)
            };

            Row::new(vec![
                Cell::from(format!("{}", i + 1)),
                Cell::from(truncate_string(&title, 35)),
                Cell::from(format!("{}", s.message_count)).style(Style::default().fg(Colors::INFO)),
                Cell::from(s.last_modified.clone()).style(Style::default().fg(Colors::TEXT_DIM)),
            ])
            .style(row_style)
            .height(1)
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Length(4),
            Constraint::Min(20),
            Constraint::Length(10),
            Constraint::Length(18),
        ],
    )
    .header(header)
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Colors::BORDER_FOCUSED))
            .title(Span::styled(
                format!(
                    " {} - Sessions ({}/{}) {} ",
                    ws_name,
                    app.visible_session_count(),
                    app.sessions.len(),
                    if !app.session_filter_query.is_empty() {
                        "filtered"
                    } else {
                        ""
                    },
                ),
                Style::default().fg(Colors::ACCENT),
            )),
    )
    .row_highlight_style(Style::default().bg(Colors::SELECTED_BG))
    .highlight_symbol("▎ ");

    let mut state = TableState::default();
    state.select(Some(app.session_index));

    frame.render_stateful_widget(table, area, &mut state);
}

/// Render message preview
fn render_message_preview(frame: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Colors::BORDER))
        .title(Span::styled(
            " Message Preview ",
            Style::default().fg(Colors::ACCENT),
        ));

    let Some(session) = app.current_session() else {
        let text = Paragraph::new(Text::styled(
            "Select a session to preview messages",
            Style::default().fg(Colors::TEXT_DIM),
        ))
        .block(block);
        frame.render_widget(text, area);
        return;
    };

    let requests = &session.session.requests;
    if requests.is_empty() {
        let text = Paragraph::new(Text::styled(
            "No messages in this session",
            Style::default().fg(Colors::TEXT_DIM),
        ))
        .block(block);
        frame.render_widget(text, area);
        return;
    }

    let mut lines: Vec<Line> = Vec::new();

    for (i, req) in requests.iter().take(10).enumerate() {
        // User message
        if let Some(msg) = &req.message {
            let text = msg.get_text();
            lines.push(Line::from(vec![
                Span::styled("▎ ", Style::default().fg(Colors::ACCENT)),
                Span::styled(
                    format!("{}. User", i + 1),
                    Style::default().fg(Colors::ACCENT).bold(),
                ),
            ]));
            lines.push(Line::from(Span::styled(
                format!("  {}", truncate_string(&text, 55)),
                Style::default().fg(Colors::TEXT),
            )));
        }

        // Assistant response
        if let Some(resp) = &req.response {
            if let Some(result) = extract_response_text(resp) {
                lines.push(Line::from(vec![
                    Span::styled("▎ ", Style::default().fg(Colors::SECONDARY)),
                    Span::styled("Assistant", Style::default().fg(Colors::SECONDARY).bold()),
                ]));
                lines.push(Line::from(Span::styled(
                    format!("  {}", truncate_string(&result, 55)),
                    Style::default().fg(Colors::TEXT),
                )));
            }
        }

        lines.push(Line::raw(""));
    }

    if requests.len() > 10 {
        lines.push(Line::from(Span::styled(
            format!("... and {} more messages", requests.len() - 10),
            Style::default().fg(Colors::TEXT_DIM).italic(),
        )));
    }

    let paragraph = Paragraph::new(lines).block(block).wrap(Wrap { trim: true });

    frame.render_widget(paragraph, area);
}

/// Render session detail view
fn render_session_detail_view(frame: &mut Frame, app: &App, area: Rect) {
    let Some(session) = app.current_session() else {
        return;
    };

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(5), Constraint::Min(0)])
        .split(area);

    // Session info header
    let info_block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Colors::BORDER_FOCUSED))
        .title(Span::styled(
            " Session Info ",
            Style::default().fg(Colors::ACCENT),
        ));

    let title = session.session.title();
    let info_text = Text::from(vec![
        Line::from(vec![
            Span::styled("  Title: ", Style::default().fg(Colors::TEXT_DIM)),
            Span::styled(&title, Style::default().fg(Colors::TEXT).bold()),
        ]),
        Line::from(vec![
            Span::styled("  File: ", Style::default().fg(Colors::TEXT_DIM)),
            Span::styled(&session.filename, Style::default().fg(Colors::TEAL)),
            Span::styled("  ·  Modified: ", Style::default().fg(Colors::TEXT_DIM)),
            Span::styled(&session.last_modified, Style::default().fg(Colors::INFO)),
            Span::styled("  ·  Messages: ", Style::default().fg(Colors::TEXT_DIM)),
            Span::styled(
                format!("{}", session.message_count),
                Style::default().fg(Colors::TEAL),
            ),
        ]),
    ]);

    let info_paragraph = Paragraph::new(info_text).block(info_block);
    frame.render_widget(info_paragraph, chunks[0]);

    // Message list
    let msg_block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Colors::BORDER))
        .title(Span::styled(
            " Messages ",
            Style::default().fg(Colors::ACCENT),
        ));

    let mut lines: Vec<Line> = Vec::new();

    for (i, req) in session.session.requests.iter().enumerate() {
        // Timestamp
        if let Some(ts) = req.timestamp {
            let dt = chrono::DateTime::from_timestamp_millis(ts)
                .map(|d| d.format("%Y-%m-%d %H:%M:%S").to_string())
                .unwrap_or_else(|| "unknown".to_string());
            lines.push(Line::from(Span::styled(
                format!("  {} ", dt),
                Style::default().fg(Colors::TEXT_DIM),
            )));
        }

        // User message
        if let Some(msg) = &req.message {
            let text = msg.get_text();
            lines.push(Line::from(vec![
                Span::styled("  ▎ ", Style::default().fg(Colors::ACCENT)),
                Span::styled(
                    format!("[{}] User", i + 1),
                    Style::default().fg(Colors::ACCENT).bold(),
                ),
            ]));
            for line in text.lines() {
                lines.push(Line::from(Span::styled(
                    format!("    {}", line),
                    Style::default().fg(Colors::TEXT),
                )));
            }
            lines.push(Line::raw(""));
        }

        // Assistant response
        if let Some(resp) = &req.response {
            if let Some(result) = extract_response_text(resp) {
                lines.push(Line::from(vec![
                    Span::styled("  ▎ ", Style::default().fg(Colors::SECONDARY)),
                    Span::styled("Assistant", Style::default().fg(Colors::SECONDARY).bold()),
                ]));
                for line in result.lines().take(20) {
                    lines.push(Line::from(Span::styled(
                        format!("    {}", line),
                        Style::default().fg(Colors::TEXT),
                    )));
                }
                lines.push(Line::raw(""));
            }
        }

        lines.push(Line::raw(""));
    }

    let paragraph = Paragraph::new(lines)
        .block(msg_block)
        .scroll((app.detail_scroll as u16, 0))
        .wrap(Wrap { trim: false });

    frame.render_widget(paragraph, chunks[1]);

    // Scrollbar
    let scrollbar = Scrollbar::new(ScrollbarOrientation::VerticalRight)
        .begin_symbol(Some("▲"))
        .end_symbol(Some("▼"));

    let total_lines = session.session.requests.len() * 5; // Approximate
    let mut scrollbar_state = ScrollbarState::new(total_lines).position(app.detail_scroll);

    frame.render_stateful_widget(
        scrollbar,
        chunks[1].inner(ratatui::layout::Margin {
            horizontal: 0,
            vertical: 1,
        }),
        &mut scrollbar_state,
    );
}

/// Render the search results view
fn render_search_results(frame: &mut Frame, app: &App, area: Rect) {
    if app.search_results.is_empty() {
        let block = Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Colors::BORDER))
            .title(Span::styled(
                format!(" Search: \"{}\" - No results ", app.search_query),
                Style::default().fg(Colors::ACCENT),
            ));
        let text = Paragraph::new(Text::styled(
            "No sessions found matching your query.",
            Style::default().fg(Colors::TEXT_DIM),
        ))
        .block(block);
        frame.render_widget(text, area);
        return;
    }

    let header_cells = ["#", "Workspace", "Title", "Messages", "Modified"]
        .iter()
        .map(|h| Cell::from(*h).style(Style::default().fg(Colors::ACCENT).bold()));

    let header = Row::new(header_cells)
        .style(Style::default().bg(Colors::HEADER_BG))
        .height(1);

    let rows: Vec<Row> = app
        .search_results
        .iter()
        .enumerate()
        .map(|(i, sr)| {
            let is_selected = i == app.search_index;
            let title = sr.session_info.session.title();
            let ws_name = sr
                .workspace_project
                .split(['/', '\\'])
                .next_back()
                .unwrap_or(&sr.workspace_project)
                .to_string();

            let row_style = if is_selected {
                Style::default()
                    .bg(Colors::SELECTED_BG)
                    .fg(Colors::SELECTED_FG)
            } else {
                Style::default().fg(Colors::TEXT)
            };

            Row::new(vec![
                Cell::from(format!("{}", i + 1)),
                Cell::from(truncate_string(&ws_name, 20)).style(Style::default().fg(Colors::TEAL)),
                Cell::from(truncate_string(&title, 35)),
                Cell::from(format!("{}", sr.session_info.message_count))
                    .style(Style::default().fg(Colors::INFO)),
                Cell::from(sr.session_info.last_modified.clone())
                    .style(Style::default().fg(Colors::TEXT_DIM)),
            ])
            .style(row_style)
            .height(1)
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Length(4),
            Constraint::Length(22),
            Constraint::Min(20),
            Constraint::Length(10),
            Constraint::Length(18),
        ],
    )
    .header(header)
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Colors::BORDER_FOCUSED))
            .title(Span::styled(
                format!(
                    " Search: \"{}\" ({} results) ",
                    app.search_query,
                    app.search_results.len()
                ),
                Style::default().fg(Colors::ACCENT),
            )),
    )
    .row_highlight_style(Style::default().bg(Colors::SELECTED_BG))
    .highlight_symbol("▎ ");

    let mut state = TableState::default();
    state.select(Some(app.search_index));

    frame.render_stateful_widget(table, area, &mut state);
}

/// Render export format picker overlay
fn render_export_picker(frame: &mut Frame, app: &App) {
    let area = centered_rect(40, 30, frame.area());
    frame.render_widget(Clear, area);

    let formats = ExportFormat::all();
    let mut lines: Vec<Line> = vec![
        Line::from(Span::styled(
            "Select Export Format",
            Style::default().fg(Colors::ACCENT).bold(),
        )),
        Line::raw(""),
    ];

    for (i, fmt) in formats.iter().enumerate() {
        let is_selected = i == app.export_format_index;
        let marker = if is_selected { "▎ " } else { "  " };
        let style = if is_selected {
            Style::default()
                .fg(Colors::SELECTED_FG)
                .bg(Colors::SELECTED_BG)
                .bold()
        } else {
            Style::default().fg(Colors::TEXT)
        };
        lines.push(Line::from(vec![
            Span::styled(marker, Style::default().fg(Colors::ACCENT)),
            Span::styled(format!("[{}] {}", i + 1, fmt.label()), style),
        ]));
    }

    lines.push(Line::raw(""));
    lines.push(Line::from(vec![
        Span::styled("Enter", Style::default().fg(Colors::ACCENT)),
        Span::styled(" confirm  ", Style::default().fg(Colors::TEXT_DIM)),
        Span::styled("1-4", Style::default().fg(Colors::ACCENT)),
        Span::styled(" quick select  ", Style::default().fg(Colors::TEXT_DIM)),
        Span::styled("Esc", Style::default().fg(Colors::ACCENT)),
        Span::styled(" cancel", Style::default().fg(Colors::TEXT_DIM)),
    ]));

    let picker = Paragraph::new(lines)
        .block(
            Block::default()
                .title(Span::styled(
                    " Export ",
                    Style::default().fg(Colors::ACCENT).bold(),
                ))
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Colors::BORDER_FOCUSED))
                .style(Style::default().bg(Colors::BG)),
        )
        .wrap(Wrap { trim: true });

    frame.render_widget(picker, area);
}

/// Render search input overlay
fn render_search_input(frame: &mut Frame, app: &App) {
    let area = centered_rect(50, 20, frame.area());
    frame.render_widget(Clear, area);

    let lines = vec![
        Line::from(Span::styled(
            "Global Search",
            Style::default().fg(Colors::ACCENT).bold(),
        )),
        Line::raw(""),
        Line::from(vec![
            Span::styled(" Query: ", Style::default().fg(Colors::TEXT_DIM)),
            Span::styled(&app.search_query, Style::default().fg(Colors::TEXT)),
            Span::styled("_", Style::default().fg(Colors::ACCENT)),
        ]),
        Line::raw(""),
        Line::from(vec![
            Span::styled("Enter", Style::default().fg(Colors::ACCENT)),
            Span::styled(" search  ", Style::default().fg(Colors::TEXT_DIM)),
            Span::styled("Esc", Style::default().fg(Colors::ACCENT)),
            Span::styled(" cancel", Style::default().fg(Colors::TEXT_DIM)),
        ]),
    ];

    let input = Paragraph::new(lines)
        .block(
            Block::default()
                .title(Span::styled(
                    " Search ",
                    Style::default().fg(Colors::ACCENT).bold(),
                ))
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Colors::BORDER_FOCUSED))
                .style(Style::default().bg(Colors::BG)),
        )
        .wrap(Wrap { trim: true });

    frame.render_widget(input, area);
}

/// Render delete confirmation overlay
fn render_delete_confirm(frame: &mut Frame) {
    let area = centered_rect(40, 20, frame.area());
    frame.render_widget(Clear, area);

    let lines = vec![
        Line::from(Span::styled(
            "Delete Session?",
            Style::default().fg(Colors::WARNING).bold(),
        )),
        Line::raw(""),
        Line::from(Span::styled(
            "Press d again to confirm deletion.",
            Style::default().fg(Colors::TEXT),
        )),
        Line::from(Span::styled(
            "Press Esc to cancel.",
            Style::default().fg(Colors::TEXT_DIM),
        )),
    ];

    let dialog = Paragraph::new(lines)
        .block(
            Block::default()
                .title(Span::styled(
                    " Confirm ",
                    Style::default().fg(Colors::WARNING).bold(),
                ))
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Colors::WARNING))
                .style(Style::default().bg(Colors::BG)),
        )
        .wrap(Wrap { trim: true });

    frame.render_widget(dialog, area);
}

/// Render the footer/status bar
fn render_footer(frame: &mut Frame, app: &App, area: Rect) {
    let spans: Vec<Span> = if app.filter_active {
        vec![
            Span::styled(" Filter: ", Style::default().fg(Colors::TEXT_DIM)),
            Span::styled(
                app.filter_query.as_str(),
                Style::default().fg(Colors::ACCENT),
            ),
            Span::styled("_", Style::default().fg(Colors::ACCENT)),
            Span::raw("  "),
            Span::styled("Enter", Style::default().fg(Colors::ACCENT)),
            Span::styled(" confirm  ", Style::default().fg(Colors::TEXT_DIM)),
            Span::styled("Esc", Style::default().fg(Colors::ACCENT)),
            Span::styled(" cancel", Style::default().fg(Colors::TEXT_DIM)),
        ]
    } else if app.session_filter_active {
        vec![
            Span::styled(" Session Filter: ", Style::default().fg(Colors::TEXT_DIM)),
            Span::styled(
                app.session_filter_query.as_str(),
                Style::default().fg(Colors::ACCENT),
            ),
            Span::styled("_", Style::default().fg(Colors::ACCENT)),
            Span::raw("  "),
            Span::styled("Enter", Style::default().fg(Colors::ACCENT)),
            Span::styled(" confirm  ", Style::default().fg(Colors::TEXT_DIM)),
            Span::styled("Esc", Style::default().fg(Colors::ACCENT)),
            Span::styled(" cancel", Style::default().fg(Colors::TEXT_DIM)),
        ]
    } else {
        let hints: &[(&str, &str)] = match app.mode {
            AppMode::Workspaces => &[
                ("↑↓", "navigate"),
                ("Enter", "select"),
                ("/", "filter"),
                ("s", "search"),
                ("r", "refresh"),
                ("?", "help"),
                ("q", "quit"),
            ],
            AppMode::Sessions => &[
                ("↑↓", "navigate"),
                ("Enter", "details"),
                ("/", "filter"),
                ("o", "sort"),
                ("e", "export"),
                ("d", "delete"),
                ("y", "yank"),
                ("s", "search"),
                ("Esc", "back"),
                ("?", "help"),
            ],
            AppMode::SessionDetail => &[
                ("↑↓", "scroll"),
                ("e", "export"),
                ("d", "delete"),
                ("y", "yank"),
                ("Esc", "back"),
                ("?", "help"),
            ],
            AppMode::SearchResults => &[
                ("↑↓", "navigate"),
                ("Enter", "open"),
                ("e", "export"),
                ("y", "yank"),
                ("Esc", "back"),
                ("?", "help"),
            ],
            AppMode::Help => &[("any key", "close")],
        };
        let mut s: Vec<Span> = vec![Span::raw(" ")];
        for (i, (key, desc)) in hints.iter().enumerate() {
            if i > 0 {
                s.push(Span::raw("  "));
            }
            s.push(Span::styled(*key, Style::default().fg(Colors::ACCENT)));
            s.push(Span::styled(
                format!(" {}", desc),
                Style::default().fg(Colors::TEXT_DIM),
            ));
        }
        if let Some(msg) = &app.yank_message {
            s.push(Span::raw("    "));
            s.push(Span::styled(msg.clone(), Style::default().fg(Colors::TEAL)));
        }
        if let Some(status) = &app.status_message {
            s.push(Span::raw("    "));
            s.push(Span::styled(
                status.clone(),
                Style::default().fg(Colors::WARNING),
            ));
        }
        s
    };

    let footer = Paragraph::new(Line::from(spans)).block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Colors::BORDER))
            .style(Style::default().bg(Colors::HEADER_BG)),
    );

    frame.render_widget(footer, area);
}

/// Render help overlay
fn render_help_overlay(frame: &mut Frame) {
    let area = centered_rect(60, 80, frame.area());

    frame.render_widget(Clear, area);

    let help_text = vec![
        Line::from(Span::styled(
            "Keyboard Shortcuts",
            Style::default().fg(Colors::ACCENT).bold(),
        )),
        Line::raw(""),
        Line::from(vec![Span::styled(
            "Navigation",
            Style::default().fg(Colors::ACCENT).bold(),
        )]),
        Line::from(vec![
            Span::styled("  j / Down    ", Style::default().fg(Colors::ACCENT)),
            Span::styled("Move down", Style::default().fg(Colors::TEXT)),
        ]),
        Line::from(vec![
            Span::styled("  k / Up      ", Style::default().fg(Colors::ACCENT)),
            Span::styled("Move up", Style::default().fg(Colors::TEXT)),
        ]),
        Line::from(vec![
            Span::styled("  g           ", Style::default().fg(Colors::ACCENT)),
            Span::styled("Go to top", Style::default().fg(Colors::TEXT)),
        ]),
        Line::from(vec![
            Span::styled("  G           ", Style::default().fg(Colors::ACCENT)),
            Span::styled("Go to bottom", Style::default().fg(Colors::TEXT)),
        ]),
        Line::from(vec![
            Span::styled("  PgUp/PgDn   ", Style::default().fg(Colors::ACCENT)),
            Span::styled("Page up/down", Style::default().fg(Colors::TEXT)),
        ]),
        Line::from(vec![
            Span::styled("  Enter       ", Style::default().fg(Colors::ACCENT)),
            Span::styled("Select / Enter view", Style::default().fg(Colors::TEXT)),
        ]),
        Line::from(vec![
            Span::styled("  Esc         ", Style::default().fg(Colors::ACCENT)),
            Span::styled("Go back / Cancel", Style::default().fg(Colors::TEXT)),
        ]),
        Line::raw(""),
        Line::from(vec![Span::styled(
            "Search & Filter",
            Style::default().fg(Colors::ACCENT).bold(),
        )]),
        Line::from(vec![
            Span::styled("  /           ", Style::default().fg(Colors::ACCENT)),
            Span::styled(
                "Filter (workspaces or sessions)",
                Style::default().fg(Colors::TEXT),
            ),
        ]),
        Line::from(vec![
            Span::styled("  s           ", Style::default().fg(Colors::ACCENT)),
            Span::styled(
                "Global search across all workspaces",
                Style::default().fg(Colors::TEXT),
            ),
        ]),
        Line::from(vec![
            Span::styled("  o           ", Style::default().fg(Colors::ACCENT)),
            Span::styled(
                "Cycle sort order (sessions view)",
                Style::default().fg(Colors::TEXT),
            ),
        ]),
        Line::raw(""),
        Line::from(vec![Span::styled(
            "Actions",
            Style::default().fg(Colors::ACCENT).bold(),
        )]),
        Line::from(vec![
            Span::styled("  e           ", Style::default().fg(Colors::ACCENT)),
            Span::styled(
                "Export session (pick format)",
                Style::default().fg(Colors::TEXT),
            ),
        ]),
        Line::from(vec![
            Span::styled("  d           ", Style::default().fg(Colors::ACCENT)),
            Span::styled(
                "Delete session (press twice to confirm)",
                Style::default().fg(Colors::TEXT),
            ),
        ]),
        Line::from(vec![
            Span::styled("  y           ", Style::default().fg(Colors::ACCENT)),
            Span::styled(
                "Yank (copy) session text",
                Style::default().fg(Colors::TEXT),
            ),
        ]),
        Line::from(vec![
            Span::styled("  r           ", Style::default().fg(Colors::ACCENT)),
            Span::styled("Refresh data", Style::default().fg(Colors::TEXT)),
        ]),
        Line::raw(""),
        Line::from(vec![Span::styled(
            "General",
            Style::default().fg(Colors::ACCENT).bold(),
        )]),
        Line::from(vec![
            Span::styled("  ?           ", Style::default().fg(Colors::ACCENT)),
            Span::styled("Toggle this help", Style::default().fg(Colors::TEXT)),
        ]),
        Line::from(vec![
            Span::styled("  q           ", Style::default().fg(Colors::ACCENT)),
            Span::styled("Quit application", Style::default().fg(Colors::TEXT)),
        ]),
        Line::raw(""),
        Line::from(Span::styled(
            "Press any key to close",
            Style::default().fg(Colors::TEXT_DIM).italic(),
        )),
    ];

    let help = Paragraph::new(help_text)
        .block(
            Block::default()
                .title(Span::styled(
                    " Help ",
                    Style::default().fg(Colors::ACCENT).bold(),
                ))
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Colors::BORDER_FOCUSED))
                .style(Style::default().bg(Colors::BG)),
        )
        .wrap(Wrap { trim: true });

    frame.render_widget(help, area);
}

/// Helper to create a centered rectangle
fn centered_rect(percent_x: u16, percent_y: u16, r: Rect) -> Rect {
    let popup_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Percentage((100 - percent_y) / 2),
            Constraint::Percentage(percent_y),
            Constraint::Percentage((100 - percent_y) / 2),
        ])
        .split(r);

    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(popup_layout[1])[1]
}

/// Truncate a path for display
fn truncate_path(path: &str, max_len: usize) -> String {
    if path.len() <= max_len {
        return path.to_string();
    }

    // Try to show the end of the path
    let parts: Vec<&str> = path.split(['/', '\\']).collect();
    let mut result = String::new();

    for part in parts.iter().rev() {
        if result.is_empty() {
            result = part.to_string();
        } else if result.len() + part.len() + 4 < max_len {
            result = format!("{}/{}", part, result);
        } else {
            result = format!(".../{}", result);
            break;
        }
    }

    result
}

/// Truncate a string for display
fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len.saturating_sub(3)])
    }
}
