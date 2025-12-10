//! Browser authentication detection for web-based LLM providers
//!
//! This module reads browser cookies (without opening windows) to detect
//! which cloud LLM providers the user is authenticated with.

use anyhow::{Context, Result};
use colored::Colorize;
use rusqlite::{Connection, OpenFlags};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

// AES-GCM imports reserved for future cookie decryption
#[cfg(windows)]
#[allow(unused_imports)]
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};

/// Supported browser types for cookie extraction
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BrowserType {
    Chrome,
    Edge,
    Firefox,
    Brave,
    Vivaldi,
    Opera,
}

impl BrowserType {
    pub fn name(&self) -> &'static str {
        match self {
            BrowserType::Chrome => "Chrome",
            BrowserType::Edge => "Edge",
            BrowserType::Firefox => "Firefox",
            BrowserType::Brave => "Brave",
            BrowserType::Vivaldi => "Vivaldi",
            BrowserType::Opera => "Opera",
        }
    }

    /// Get the default profile path for this browser
    #[cfg(windows)]
    pub fn profile_path(&self) -> Option<PathBuf> {
        let local_app_data = dirs::data_local_dir()?;
        let roaming_app_data = dirs::data_dir()?;

        let path = match self {
            BrowserType::Chrome => local_app_data.join("Google/Chrome/User Data/Default"),
            BrowserType::Edge => local_app_data.join("Microsoft/Edge/User Data/Default"),
            BrowserType::Brave => {
                local_app_data.join("BraveSoftware/Brave-Browser/User Data/Default")
            }
            BrowserType::Vivaldi => local_app_data.join("Vivaldi/User Data/Default"),
            BrowserType::Opera => roaming_app_data.join("Opera Software/Opera Stable"),
            BrowserType::Firefox => {
                // Firefox uses random profile directories
                // Select the profile with the largest cookies.sqlite (most likely active)
                let profiles_dir = roaming_app_data.join("Mozilla/Firefox/Profiles");
                if profiles_dir.exists() {
                    if let Ok(entries) = fs::read_dir(&profiles_dir) {
                        let mut best_profile: Option<(PathBuf, u64)> = None;

                        for entry in entries.flatten() {
                            let profile_path = entry.path();
                            let cookies_path = profile_path.join("cookies.sqlite");

                            if cookies_path.exists() {
                                if let Ok(metadata) = fs::metadata(&cookies_path) {
                                    let size = metadata.len();
                                    if best_profile.as_ref().map_or(true, |(_, s)| size > *s) {
                                        best_profile = Some((profile_path, size));
                                    }
                                }
                            }
                        }

                        if let Some((path, _)) = best_profile {
                            return Some(path);
                        }
                    }
                }
                return None;
            }
        };

        if path.exists() {
            Some(path)
        } else {
            None
        }
    }

    #[cfg(not(windows))]
    pub fn profile_path(&self) -> Option<PathBuf> {
        let home = dirs::home_dir()?;

        let path = match self {
            BrowserType::Chrome => {
                #[cfg(target_os = "macos")]
                {
                    home.join("Library/Application Support/Google/Chrome/Default")
                }
                #[cfg(target_os = "linux")]
                {
                    home.join(".config/google-chrome/Default")
                }
            }
            BrowserType::Edge => {
                #[cfg(target_os = "macos")]
                {
                    home.join("Library/Application Support/Microsoft Edge/Default")
                }
                #[cfg(target_os = "linux")]
                {
                    home.join(".config/microsoft-edge/Default")
                }
            }
            BrowserType::Firefox => {
                #[cfg(target_os = "macos")]
                let profiles_dir = home.join("Library/Application Support/Firefox/Profiles");
                #[cfg(target_os = "linux")]
                let profiles_dir = home.join(".mozilla/firefox");

                if profiles_dir.exists() {
                    if let Ok(entries) = fs::read_dir(&profiles_dir) {
                        for entry in entries.flatten() {
                            let name = entry.file_name().to_string_lossy().to_string();
                            if name.ends_with(".default-release") || name.ends_with(".default") {
                                return Some(entry.path());
                            }
                        }
                    }
                }
                return None;
            }
            BrowserType::Brave => {
                #[cfg(target_os = "macos")]
                {
                    home.join("Library/Application Support/BraveSoftware/Brave-Browser/Default")
                }
                #[cfg(target_os = "linux")]
                {
                    home.join(".config/BraveSoftware/Brave-Browser/Default")
                }
            }
            _ => return None,
        };

        if path.exists() {
            Some(path)
        } else {
            None
        }
    }

    /// Get the cookie database path for Chromium-based browsers
    pub fn cookies_path(&self) -> Option<PathBuf> {
        let profile = self.profile_path()?;

        match self {
            BrowserType::Firefox => {
                let path = profile.join("cookies.sqlite");
                if path.exists() {
                    Some(path)
                } else {
                    None
                }
            }
            _ => {
                // Chromium-based browsers store cookies in Network/Cookies (newer) or Cookies (older)
                let network_path = profile.join("Network/Cookies");
                if network_path.exists() {
                    return Some(network_path);
                }
                let old_path = profile.join("Cookies");
                if old_path.exists() {
                    Some(old_path)
                } else {
                    None
                }
            }
        }
    }

    /// Get the Local State file path (contains encryption key for Chromium browsers)
    /// Reserved for future cookie decryption implementation
    #[cfg(windows)]
    #[allow(dead_code)]
    pub fn local_state_path(&self) -> Option<PathBuf> {
        let local_app_data = dirs::data_local_dir()?;
        let roaming_app_data = dirs::data_dir()?;

        let path = match self {
            BrowserType::Chrome => local_app_data.join("Google/Chrome/User Data/Local State"),
            BrowserType::Edge => local_app_data.join("Microsoft/Edge/User Data/Local State"),
            BrowserType::Brave => {
                local_app_data.join("BraveSoftware/Brave-Browser/User Data/Local State")
            }
            BrowserType::Vivaldi => local_app_data.join("Vivaldi/User Data/Local State"),
            BrowserType::Opera => roaming_app_data.join("Opera Software/Opera Stable/Local State"),
            BrowserType::Firefox => return None, // Firefox doesn't use this
        };

        if path.exists() {
            Some(path)
        } else {
            None
        }
    }
}

/// Web LLM provider authentication info
#[derive(Debug, Clone)]
pub struct ProviderAuth {
    pub name: &'static str,
    pub domain: &'static str,
    pub auth_cookie_names: &'static [&'static str],
    #[allow(dead_code)]
    pub description: &'static str,
}

/// Known web LLM providers and their authentication cookies
pub const WEB_LLM_PROVIDERS: &[ProviderAuth] = &[
    ProviderAuth {
        name: "ChatGPT",
        domain: "openai.com", // Covers chat.openai.com, chatgpt.com redirects here
        auth_cookie_names: &[
            "__Secure-next-auth.session-token",
            "_puid",
            "__cf_bm",
            "cf_clearance",
        ],
        description: "OpenAI ChatGPT",
    },
    ProviderAuth {
        name: "Claude",
        domain: "claude.ai",
        auth_cookie_names: &["sessionKey", "__cf_bm"],
        description: "Anthropic Claude",
    },
    ProviderAuth {
        name: "Gemini",
        domain: "gemini.google.com",
        auth_cookie_names: &["SID", "HSID", "SSID"],
        description: "Google Gemini",
    },
    ProviderAuth {
        name: "Perplexity",
        domain: "perplexity.ai",
        auth_cookie_names: &["pplx.visitor-id", "__Secure-next-auth.session-token"],
        description: "Perplexity AI",
    },
    ProviderAuth {
        name: "DeepSeek",
        domain: "chat.deepseek.com",
        auth_cookie_names: &["token", "sessionid"],
        description: "DeepSeek Chat",
    },
    ProviderAuth {
        name: "Poe",
        domain: "poe.com",
        auth_cookie_names: &["p-b", "p-lat"],
        description: "Quora Poe",
    },
    ProviderAuth {
        name: "HuggingChat",
        domain: "huggingface.co",
        auth_cookie_names: &["token", "hf-chat"],
        description: "HuggingFace Chat",
    },
    ProviderAuth {
        name: "Copilot",
        domain: "copilot.microsoft.com",
        auth_cookie_names: &["_U", "MUID"],
        description: "Microsoft Copilot",
    },
    ProviderAuth {
        name: "Mistral",
        domain: "chat.mistral.ai",
        auth_cookie_names: &["__Secure-next-auth.session-token"],
        description: "Mistral Le Chat",
    },
    ProviderAuth {
        name: "Cohere",
        domain: "coral.cohere.com",
        auth_cookie_names: &["session", "auth_token"],
        description: "Cohere Coral",
    },
    ProviderAuth {
        name: "Groq",
        domain: "groq.com",
        auth_cookie_names: &["__Secure-next-auth.session-token"],
        description: "Groq Cloud",
    },
    ProviderAuth {
        name: "Phind",
        domain: "phind.com",
        auth_cookie_names: &["__Secure-next-auth.session-token", "phind-session"],
        description: "Phind AI",
    },
    ProviderAuth {
        name: "Character.AI",
        domain: "character.ai",
        auth_cookie_names: &["token", "web-next-auth.session-token"],
        description: "Character.AI",
    },
    ProviderAuth {
        name: "You.com",
        domain: "you.com",
        auth_cookie_names: &["stytch_session", "youchat_session"],
        description: "You.com AI",
    },
    ProviderAuth {
        name: "Pi",
        domain: "pi.ai",
        auth_cookie_names: &["__Secure-next-auth.session-token"],
        description: "Inflection Pi",
    },
];

/// Result of checking browser authentication
#[derive(Debug, Clone)]
pub struct BrowserAuthResult {
    pub browser: BrowserType,
    pub provider: String,
    pub authenticated: bool,
    #[allow(dead_code)]
    pub cookies_found: Vec<String>,
}

/// Scan browsers for authenticated LLM providers
pub fn scan_browser_auth() -> Vec<BrowserAuthResult> {
    scan_browser_auth_internal(false)
}

/// Scan browsers for authenticated LLM providers with verbose output
pub fn scan_browser_auth_verbose() -> Vec<BrowserAuthResult> {
    scan_browser_auth_internal(true)
}

fn scan_browser_auth_internal(verbose: bool) -> Vec<BrowserAuthResult> {
    let mut results = Vec::new();

    let browsers = [
        BrowserType::Edge,
        BrowserType::Chrome,
        BrowserType::Brave,
        BrowserType::Firefox,
        BrowserType::Vivaldi,
        BrowserType::Opera,
    ];

    for browser in browsers {
        if let Some(cookies_path) = browser.cookies_path() {
            if verbose {
                println!(
                    "      {} {} cookies: {}",
                    "→".dimmed(),
                    browser.name(),
                    cookies_path.display()
                );
            }
            match scan_browser_cookies_internal(&browser, &cookies_path, verbose) {
                Ok(browser_results) => results.extend(browser_results),
                Err(e) => {
                    if verbose {
                        println!("        {} Direct access failed: {}", "!".yellow(), e);
                        println!("        {} Trying copy method...", "→".dimmed());
                    }
                    // Browser might be open and locking the database
                    // Try copying to temp file
                    match scan_browser_cookies_with_copy_internal(&browser, &cookies_path, verbose)
                    {
                        Ok(browser_results) => results.extend(browser_results),
                        Err(e2) => {
                            if verbose {
                                println!("        {} Copy method also failed: {}", "✗".red(), e2);
                            }
                        }
                    }
                }
            }
        }
    }

    results
}

/// Get list of installed browsers
pub fn get_installed_browsers() -> Vec<BrowserType> {
    let browsers = [
        BrowserType::Edge,
        BrowserType::Chrome,
        BrowserType::Brave,
        BrowserType::Firefox,
        BrowserType::Vivaldi,
        BrowserType::Opera,
    ];

    browsers
        .into_iter()
        .filter(|b| b.profile_path().is_some())
        .collect()
}

/// Scan a browser's cookie database for LLM provider authentication
#[allow(dead_code)]
fn scan_browser_cookies(
    browser: &BrowserType,
    cookies_path: &PathBuf,
) -> Result<Vec<BrowserAuthResult>> {
    scan_browser_cookies_internal(browser, cookies_path, false)
}

fn scan_browser_cookies_internal(
    browser: &BrowserType,
    cookies_path: &PathBuf,
    verbose: bool,
) -> Result<Vec<BrowserAuthResult>> {
    let mut results = Vec::new();

    // Open database read-only
    let conn = Connection::open_with_flags(
        cookies_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .context("Failed to open cookie database")?;

    // Get all cookies grouped by domain
    let cookies = match *browser {
        BrowserType::Firefox => get_firefox_cookies(&conn)?,
        _ => get_chromium_cookies(&conn)?,
    };

    if verbose {
        println!(
            "        {} Found {} domains with cookies",
            "→".dimmed(),
            cookies.len()
        );

        // Show domains that might match our providers
        let llm_domains: Vec<_> = cookies
            .keys()
            .filter(|d| {
                let dl = d.to_lowercase();
                dl.contains("openai")
                    || dl.contains("claude")
                    || dl.contains("anthropic")
                    || dl.contains("google")
                    || dl.contains("perplexity")
                    || dl.contains("deepseek")
                    || dl.contains("poe")
                    || dl.contains("huggingface")
                    || dl.contains("microsoft")
                    || dl.contains("copilot")
                    || dl.contains("mistral")
                    || dl.contains("cohere")
                    || dl.contains("groq")
                    || dl.contains("phind")
                    || dl.contains("character")
            })
            .collect();

        if !llm_domains.is_empty() {
            println!("        {} LLM-related domains found:", "→".dimmed());
            for domain in &llm_domains {
                let cookie_names = cookies
                    .get(*domain)
                    .map(|v| v.join(", "))
                    .unwrap_or_default();
                println!(
                    "          {} {} -> [{}]",
                    "•".dimmed(),
                    domain,
                    cookie_names.dimmed()
                );
            }
        }
    }

    // Check each provider
    for provider in WEB_LLM_PROVIDERS {
        // Domain matching needs to handle:
        // - Exact match: "chat.openai.com"
        // - Dot-prefixed: ".openai.com"
        // - Parent domain: "openai.com" matches ".openai.com"
        let domain_cookies: Vec<&String> = cookies
            .iter()
            .filter(|(domain, _)| {
                let domain_clean = domain.trim_start_matches('.');
                let provider_domain = provider.domain.trim_start_matches('.');
                domain_clean.ends_with(provider_domain) || provider_domain.ends_with(domain_clean)
            })
            .flat_map(|(_, names)| names)
            .collect();

        let found_auth_cookies: Vec<String> = provider
            .auth_cookie_names
            .iter()
            .filter(|name| {
                domain_cookies
                    .iter()
                    .any(|c| c == *name || c.contains(*name))
            })
            .map(|s| s.to_string())
            .collect();

        let authenticated = !found_auth_cookies.is_empty();

        if verbose && !domain_cookies.is_empty() {
            println!(
                "        {} {}: domain cookies={:?}, auth cookies={:?}, authenticated={}",
                "→".dimmed(),
                provider.name,
                domain_cookies.iter().take(5).collect::<Vec<_>>(),
                found_auth_cookies,
                authenticated
            );
        }

        results.push(BrowserAuthResult {
            browser: *browser,
            provider: provider.name.to_string(),
            authenticated,
            cookies_found: found_auth_cookies,
        });
    }

    Ok(results)
}

/// Copy cookie database to temp file and scan (for when browser has lock)
#[allow(dead_code)]
fn scan_browser_cookies_with_copy(
    browser: &BrowserType,
    cookies_path: &PathBuf,
) -> Result<Vec<BrowserAuthResult>> {
    scan_browser_cookies_with_copy_internal(browser, cookies_path, false)
}

fn scan_browser_cookies_with_copy_internal(
    browser: &BrowserType,
    cookies_path: &PathBuf,
    verbose: bool,
) -> Result<Vec<BrowserAuthResult>> {
    let temp_dir = std::env::temp_dir();
    let temp_path = temp_dir.join(format!("csm_cookies_{}.db", uuid::Uuid::new_v4()));

    // Copy the database file
    fs::copy(cookies_path, &temp_path).context("Failed to copy cookie database")?;

    // Also copy the journal/wal files if they exist
    let wal_path = cookies_path.with_extension("db-wal");
    if wal_path.exists() {
        let _ = fs::copy(&wal_path, temp_path.with_extension("db-wal"));
    }
    let shm_path = cookies_path.with_extension("db-shm");
    if shm_path.exists() {
        let _ = fs::copy(&shm_path, temp_path.with_extension("db-shm"));
    }

    // Firefox uses -wal and -shm without the .db prefix
    let ff_wal = cookies_path.with_file_name(format!(
        "{}-wal",
        cookies_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
    ));
    if ff_wal.exists() {
        let _ = fs::copy(
            &ff_wal,
            temp_dir.join(format!("csm_cookies_{}.db-wal", uuid::Uuid::new_v4())),
        );
    }

    if verbose {
        println!(
            "        {} Copied to temp: {}",
            "→".dimmed(),
            temp_path.display()
        );
    }

    let result = scan_browser_cookies_internal(browser, &temp_path, verbose);

    // Clean up temp files
    let _ = fs::remove_file(&temp_path);
    let _ = fs::remove_file(temp_path.with_extension("db-wal"));
    let _ = fs::remove_file(temp_path.with_extension("db-shm"));

    result
}

/// Get cookies from Chromium-based browser database
fn get_chromium_cookies(conn: &Connection) -> Result<HashMap<String, Vec<String>>> {
    let mut cookies: HashMap<String, Vec<String>> = HashMap::new();

    // Query cookie names grouped by host
    let mut stmt = conn.prepare(
        "SELECT host_key, name FROM cookies WHERE host_key LIKE '%.%' GROUP BY host_key, name",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    for row in rows.flatten() {
        let (host, name) = row;
        cookies.entry(host).or_default().push(name);
    }

    Ok(cookies)
}

/// Get cookies from Firefox database
fn get_firefox_cookies(conn: &Connection) -> Result<HashMap<String, Vec<String>>> {
    let mut cookies: HashMap<String, Vec<String>> = HashMap::new();

    let mut stmt = conn
        .prepare("SELECT host, name FROM moz_cookies WHERE host LIKE '%.%' GROUP BY host, name")?;

    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    for row in rows.flatten() {
        let (host, name) = row;
        cookies.entry(host).or_default().push(name);
    }

    Ok(cookies)
}

/// Summary of authenticated providers across all browsers
/// Reserved for future programmatic access to auth state
#[allow(dead_code)]
#[derive(Debug, Default)]
pub struct AuthSummary {
    pub browsers_checked: Vec<BrowserType>,
    pub authenticated_providers: HashMap<String, Vec<BrowserType>>,
    pub total_providers_authenticated: usize,
}

/// Get a summary of all authenticated web LLM providers
/// Reserved for future programmatic access to auth state
#[allow(dead_code)]
pub fn get_auth_summary() -> AuthSummary {
    let results = scan_browser_auth();
    let mut summary = AuthSummary::default();

    // Track which browsers we checked
    let mut browsers_seen = std::collections::HashSet::new();

    for result in results {
        browsers_seen.insert(result.browser);

        if result.authenticated {
            summary
                .authenticated_providers
                .entry(result.provider)
                .or_default()
                .push(result.browser);
        }
    }

    summary.browsers_checked = browsers_seen.into_iter().collect();
    summary.total_providers_authenticated = summary.authenticated_providers.len();

    summary
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_browser_type_name() {
        assert_eq!(BrowserType::Chrome.name(), "Chrome");
        assert_eq!(BrowserType::Edge.name(), "Edge");
        assert_eq!(BrowserType::Firefox.name(), "Firefox");
    }

    #[test]
    fn test_get_installed_browsers() {
        let browsers = get_installed_browsers();
        // Should return a list (may be empty if no browsers installed)
        assert!(browsers.len() <= 6);
    }

    #[test]
    fn test_provider_auth_domains() {
        // Verify all providers have valid domains
        for provider in WEB_LLM_PROVIDERS {
            assert!(!provider.domain.is_empty());
            assert!(provider.domain.contains('.'));
            assert!(!provider.auth_cookie_names.is_empty());
        }
    }

    #[test]
    fn test_auth_summary_default() {
        let summary = AuthSummary::default();
        assert!(summary.browsers_checked.is_empty());
        assert!(summary.authenticated_providers.is_empty());
        assert_eq!(summary.total_providers_authenticated, 0);
    }
}
