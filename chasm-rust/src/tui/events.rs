// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! Event handling and main TUI loop

use std::io;

use anyhow::Result;
use crossterm::{
    event::{
        self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyEventKind, KeyModifiers,
    },
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};

use super::app::{App, AppMode, ExportFormat};
use super::ui;

/// Run the TUI application
pub fn run_tui() -> Result<()> {
    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Create app state
    let mut app = App::new()?;

    // Main loop
    let res = run_app(&mut terminal, &mut app);

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    if let Err(err) = res {
        eprintln!("Error: {}", err);
    }

    Ok(())
}

/// Main application loop
fn run_app<B: ratatui::backend::Backend>(terminal: &mut Terminal<B>, app: &mut App) -> Result<()> {
    // Initial draw
    terminal.draw(|f| ui::render(f, app))?;

    loop {
        // Block waiting for input - no polling delay, instant response
        if let Event::Key(key) = event::read()? {
            // Only handle key press events, ignore release/repeat to prevent double-triggering
            if key.kind != KeyEventKind::Press {
                continue;
            }

            // Clear status message on any keypress (unless in confirm flow)
            if !app.confirm_delete {
                app.status_message = None;
            }

            // --- Export format picker ---
            if app.export_picker_active {
                match key.code {
                    KeyCode::Char('j') | KeyCode::Down => {
                        let max = ExportFormat::all().len();
                        if app.export_format_index + 1 < max {
                            app.export_format_index += 1;
                        }
                    }
                    KeyCode::Char('k') | KeyCode::Up if app.export_format_index > 0 => {
                        app.export_format_index -= 1;
                    }
                    KeyCode::Enter => app.confirm_export(),
                    KeyCode::Esc => app.cancel_export(),
                    KeyCode::Char('1') => {
                        app.export_format_index = 0;
                        app.confirm_export();
                    }
                    KeyCode::Char('2') => {
                        app.export_format_index = 1;
                        app.confirm_export();
                    }
                    KeyCode::Char('3') => {
                        app.export_format_index = 2;
                        app.confirm_export();
                    }
                    KeyCode::Char('4') => {
                        app.export_format_index = 3;
                        app.confirm_export();
                    }
                    _ => {}
                }
                terminal.draw(|f| ui::render(f, app))?;
                continue;
            }

            // --- Global search input ---
            if app.search_active {
                match key.code {
                    KeyCode::Enter => app.execute_search(),
                    KeyCode::Esc => app.cancel_search(),
                    KeyCode::Backspace => app.search_backspace(),
                    KeyCode::Char(c) => app.search_input(c),
                    _ => {}
                }
                terminal.draw(|f| ui::render(f, app))?;
                continue;
            }

            // --- Workspace filter input ---
            if app.filter_active {
                match key.code {
                    KeyCode::Enter => app.confirm_filter(),
                    KeyCode::Esc => app.cancel_filter(),
                    KeyCode::Backspace => app.filter_backspace(),
                    KeyCode::Char(c) => app.filter_input(c),
                    _ => {}
                }
                terminal.draw(|f| ui::render(f, app))?;
                continue;
            }

            // --- Session filter input ---
            if app.session_filter_active {
                match key.code {
                    KeyCode::Enter => app.confirm_session_filter(),
                    KeyCode::Esc => app.cancel_session_filter(),
                    KeyCode::Backspace => app.session_filter_backspace(),
                    KeyCode::Char(c) => app.session_filter_input(c),
                    _ => {}
                }
                terminal.draw(|f| ui::render(f, app))?;
                continue;
            }

            // Help mode - any key closes it
            if app.mode == AppMode::Help {
                app.back();
                terminal.draw(|f| ui::render(f, app))?;
                continue;
            }

            // Normal key handling
            match key.code {
                KeyCode::Char('q') => {
                    return Ok(());
                }
                KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                    return Ok(());
                }
                KeyCode::Char('?') => {
                    app.toggle_help();
                }
                // Navigation
                KeyCode::Char('j') | KeyCode::Down => {
                    app.navigate_down();
                }
                KeyCode::Char('k') | KeyCode::Up => {
                    app.navigate_up();
                }
                KeyCode::Char('g') => {
                    app.go_to_top();
                }
                KeyCode::Char('G') => {
                    app.go_to_bottom();
                }
                KeyCode::PageUp => {
                    app.page_up();
                }
                KeyCode::PageDown => {
                    app.page_down();
                }
                KeyCode::Enter => {
                    app.enter();
                }
                KeyCode::Esc | KeyCode::Backspace => {
                    if app.confirm_delete {
                        app.cancel_delete();
                    } else {
                        app.back();
                    }
                }
                // Filter (/ works in workspaces and sessions)
                KeyCode::Char('/')
                    if matches!(app.mode, AppMode::Workspaces | AppMode::Sessions) =>
                {
                    app.start_filter();
                }
                // Global search
                KeyCode::Char('s') if !matches!(app.mode, AppMode::SessionDetail) => {
                    app.start_search();
                }
                // Refresh
                KeyCode::Char('r') => {
                    app.refresh();
                }
                // Export
                KeyCode::Char('e')
                    if matches!(
                        app.mode,
                        AppMode::Sessions | AppMode::SessionDetail | AppMode::SearchResults
                    ) =>
                {
                    app.export_current_session();
                }
                // Sort (sessions view)
                KeyCode::Char('o') if app.mode == AppMode::Sessions => {
                    app.cycle_sort();
                }
                // Delete (sessions view)
                KeyCode::Char('d')
                    if matches!(app.mode, AppMode::Sessions | AppMode::SessionDetail) =>
                {
                    app.delete_current_session();
                }
                // Yank (copy) session content
                KeyCode::Char('y')
                    if matches!(
                        app.mode,
                        AppMode::Sessions | AppMode::SessionDetail | AppMode::SearchResults
                    ) =>
                {
                    app.yank_session();
                }
                _ => continue, // No redraw needed for unhandled keys
            }

            // Redraw after handling input
            terminal.draw(|f| ui::render(f, app))?;
        }
    }
}
