// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// IronBridge Desktop - Tauri Application
// Copyright 2025 Nervosys LLC

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

mod commands;
mod server;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Bring the API server up before the window shows anything.
            // Without this the app opens onto a UI whose every request fails
            // until the user separately runs `ironbridge api serve`.
            //
            // Spawned rather than blocked on: a slow first-run database
            // migration would otherwise freeze the app before it drew a
            // frame. The UI polls `get_api_server_status` and can show
            // "starting" honestly instead.
            std::thread::spawn(|| {
                let runtime = match tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                {
                    Ok(rt) => rt,
                    Err(e) => {
                        eprintln!("[ERROR] could not start API supervisor: {}", e);
                        return;
                    }
                };
                let status = runtime.block_on(server::ensure_running(server::default_port()));
                if !status.running {
                    eprintln!(
                        "[ERROR] API server unavailable: {}",
                        status.error.as_deref().unwrap_or("unknown reason")
                    );
                }
            });

            // Build tray menu
            let show = MenuItem::with_id(app, "show", "Show IronBridge", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

            // Create tray icon
            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("IronBridge - Chat Session Manager")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::get_platform,
            commands::open_devtools,
            commands::minimize_to_tray,
            commands::check_api_health,
            commands::get_api_server_status,
            commands::start_api_server,
        ])
        .on_window_event(|window, event| {
            // Intercept window close → hide to tray instead of quitting
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod hardening_tests {
    //! Guards for the webview hardening. These assert the security-relevant
    //! shape of the shipped config so a future edit cannot silently reopen the
    //! surface (a null CSP, the global Tauri API, or fs/process capabilities).

    use serde_json::Value;

    const TAURI_CONF: &str = include_str!("../tauri.conf.json");
    const CAPABILITIES: &str = include_str!("../capabilities/default.json");

    #[test]
    fn csp_is_set() {
        let conf: Value = serde_json::from_str(TAURI_CONF).expect("tauri.conf.json parses");
        let csp = &conf["app"]["security"]["csp"];
        assert!(
            csp.is_string() && !csp.as_str().unwrap().is_empty(),
            "app.security.csp must be a non-empty policy, not null: {csp:?}"
        );
        let csp = csp.as_str().unwrap();
        assert!(
            csp.contains("script-src 'self'"),
            "CSP must restrict scripts to 'self': {csp}"
        );
        assert!(
            csp.contains("object-src 'none'"),
            "CSP must forbid plugins/objects: {csp}"
        );
    }

    #[test]
    fn global_tauri_is_disabled() {
        let conf: Value = serde_json::from_str(TAURI_CONF).expect("tauri.conf.json parses");
        assert_eq!(
            conf["app"]["withGlobalTauri"],
            Value::Bool(false),
            "withGlobalTauri must be false so window.__TAURI__ is not injected"
        );
    }

    #[test]
    fn dangerous_capabilities_are_not_granted() {
        let caps: Value = serde_json::from_str(CAPABILITIES).expect("capabilities parse");
        let perms = caps["permissions"]
            .as_array()
            .expect("permissions is an array");
        for forbidden in ["fs:default", "process:default"] {
            assert!(
                !perms.iter().any(|p| p == forbidden),
                "capability {forbidden} must not be granted to the main window"
            );
        }
    }
}
