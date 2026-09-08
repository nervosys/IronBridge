//! Drive a remote Mac over SSH.
//!
//! The off-Mac story is only complete if the Xcode-only stages (a real Swift
//! project build, keychain code-signing) can be triggered *from* the non-Apple
//! host. This module builds the `ssh`/`scp` command lines to push a project to a
//! Mac, run `xcodebuild`/`security` there, and pull the products back.
//!
//! As everywhere in this crate, the plumbing is split: argument construction and
//! POSIX shell-quoting are pure and unit-tested on any host; only the runners
//! spawn `ssh`/`scp` (present on modern Windows via OpenSSH) and thus need a
//! reachable Mac.

use crate::error::Result;
use crate::process;
use crate::xcode::Xcodebuild;
use std::path::{Path, PathBuf};

/// A Mac reachable over SSH.
#[derive(Debug, Clone)]
pub struct RemoteHost {
    /// Hostname or IP.
    pub host: String,
    /// Login user, if not implied by ssh config.
    pub user: Option<String>,
    /// SSH port (defaults to 22 when `None`).
    pub port: Option<u16>,
    /// Identity (private key) file.
    pub identity: Option<PathBuf>,
    /// Enforce host-key checking (default true). Only relax on trusted networks.
    pub strict_host_key_checking: bool,
}

impl RemoteHost {
    /// A host with defaults (port 22, strict host-key checking on).
    pub fn new(host: impl Into<String>) -> Self {
        RemoteHost {
            host: host.into(),
            user: None,
            port: None,
            identity: None,
            strict_host_key_checking: true,
        }
    }

    /// Set the login user.
    pub fn user(mut self, u: impl Into<String>) -> Self {
        self.user = Some(u.into());
        self
    }
    /// Set the port.
    pub fn port(mut self, p: u16) -> Self {
        self.port = Some(p);
        self
    }
    /// Set the identity file.
    pub fn identity(mut self, p: impl Into<PathBuf>) -> Self {
        self.identity = Some(p.into());
        self
    }

    /// `user@host` (or just `host`).
    pub fn target(&self) -> String {
        match &self.user {
            Some(u) => format!("{u}@{}", self.host),
            None => self.host.clone(),
        }
    }

    /// Shared `-o` options and identity, without the port flag (whose letter
    /// differs between `ssh` and `scp`).
    fn common_opts(&self) -> Vec<String> {
        let mut o = Vec::new();
        if let Some(id) = &self.identity {
            o.push("-i".into());
            o.push(id.to_string_lossy().into_owned());
        }
        if !self.strict_host_key_checking {
            o.push("-o".into());
            o.push("StrictHostKeyChecking=no".into());
        }
        // Fail fast instead of hanging on an unreachable host.
        o.push("-o".into());
        o.push("BatchMode=yes".into());
        o
    }

    /// Full `ssh` argv to run `remote_command` on the host.
    pub fn ssh_args(&self, remote_command: &str) -> Vec<String> {
        let mut a = vec!["ssh".to_string()];
        // ssh uses lowercase -p for the port.
        if let Some(p) = self.port {
            a.push("-p".into());
            a.push(p.to_string());
        }
        a.extend(self.common_opts());
        a.push(self.target());
        // `--` stops ssh option parsing; the remote command follows as one word.
        a.push("--".into());
        a.push(remote_command.to_string());
        a
    }

    /// `scp` argv to copy a local path up to `remote_path` on the host.
    ///
    /// Note the deliberate `-P`: `scp` spells the port with a capital P while
    /// `ssh` uses lowercase `-p`. Mixing them up is the single most common SSH
    /// automation bug, so it is encoded (and tested) here once.
    pub fn scp_push_args(&self, local: &Path, remote_path: &str, recursive: bool) -> Vec<String> {
        let mut a = vec!["scp".to_string()];
        if recursive {
            a.push("-r".into());
        }
        if let Some(p) = self.port {
            a.push("-P".into());
            a.push(p.to_string());
        }
        a.extend(self.common_opts());
        a.push(local.to_string_lossy().into_owned());
        a.push(format!("{}:{}", self.target(), remote_path));
        a
    }

    /// `scp` argv to copy `remote_path` down to a local path.
    pub fn scp_pull_args(&self, remote_path: &str, local: &Path, recursive: bool) -> Vec<String> {
        let mut a = vec!["scp".to_string()];
        if recursive {
            a.push("-r".into());
        }
        if let Some(p) = self.port {
            a.push("-P".into());
            a.push(p.to_string());
        }
        a.extend(self.common_opts());
        a.push(format!("{}:{}", self.target(), remote_path));
        a.push(local.to_string_lossy().into_owned());
        a
    }

    /// Run `argv` on the remote host, optionally after `cd <workdir>`.
    pub fn run(&self, argv: &[&str], workdir: Option<&str>) -> Result<()> {
        let cmd = remote_command_line(argv, workdir);
        let args = self.ssh_args(&cmd);
        let refs: Vec<&str> = args[1..].iter().map(String::as_str).collect();
        process::run("ssh", &refs)
    }

    /// Run `argv` on the remote host and capture stdout.
    pub fn capture(&self, argv: &[&str], workdir: Option<&str>) -> Result<String> {
        let cmd = remote_command_line(argv, workdir);
        let args = self.ssh_args(&cmd);
        let refs: Vec<&str> = args[1..].iter().map(String::as_str).collect();
        process::capture("ssh", &refs)
    }

    /// Copy a file or directory tree up to the host.
    pub fn push(&self, local: &Path, remote_path: &str) -> Result<()> {
        let recursive = local.is_dir();
        let args = self.scp_push_args(local, remote_path, recursive);
        let refs: Vec<&str> = args[1..].iter().map(String::as_str).collect();
        process::run("scp", &refs)
    }

    /// Copy a file or directory tree down from the host.
    pub fn pull(&self, remote_path: &str, local: &Path, recursive: bool) -> Result<()> {
        let args = self.scp_pull_args(remote_path, local, recursive);
        let refs: Vec<&str> = args[1..].iter().map(String::as_str).collect();
        process::run("scp", &refs)
    }
}

/// Quote one argument for a POSIX (`sh`) remote shell using single quotes.
///
/// Single quotes make everything literal except a single quote itself, which is
/// closed, escaped as `\'`, and reopened — the standard, robust idiom. An empty
/// string becomes `''`.
pub fn shell_quote(arg: &str) -> String {
    if arg.is_empty() {
        return "''".to_string();
    }
    // A bare token of safe characters needs no quoting.
    if arg
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-' | b'.' | b'/' | b'@' | b'%' | b'+' | b'=' | b':'))
    {
        return arg.to_string();
    }
    let mut out = String::with_capacity(arg.len() + 2);
    out.push('\'');
    for c in arg.chars() {
        if c == '\'' {
            out.push_str("'\\''");
        } else {
            out.push(c);
        }
    }
    out.push('\'');
    out
}

/// Quote a filesystem path for `cd` on the remote shell, **preserving** a
/// leading `~` so it still expands to the remote `$HOME`.
///
/// Distinct from [`shell_quote`], whose contract is "make literal": a workdir is
/// meant to be a shell path, so a simple `~/Project` or `/Users/ci/Project` is
/// emitted verbatim (tilde expands). Only a path containing shell-special
/// characters (e.g. spaces) falls back to literal quoting — in which case `~`
/// would not expand, so give such remotes an absolute path.
pub fn quote_path(p: &str) -> String {
    let simple = !p.is_empty()
        && p.bytes().all(|b| {
            b.is_ascii_alphanumeric()
                || matches!(b, b'_' | b'-' | b'.' | b'/' | b'@' | b'%' | b'+' | b'=' | b':' | b'~')
        });
    if simple {
        p.to_string()
    } else {
        shell_quote(p)
    }
}

/// Build the remote `sh` command line from an argv, quoting each word and
/// optionally prefixing `cd <workdir> && `.
pub fn remote_command_line(argv: &[&str], workdir: Option<&str>) -> String {
    let joined = argv
        .iter()
        .map(|a| shell_quote(a))
        .collect::<Vec<_>>()
        .join(" ");
    match workdir {
        Some(dir) => format!("cd {} && {joined}", quote_path(dir)),
        None => joined,
    }
}

/// Drive Xcode on a remote Mac.
#[derive(Debug, Clone)]
pub struct RemoteXcode {
    /// The Mac.
    pub host: RemoteHost,
    /// The remote directory the project lives in (commands run from here).
    pub workdir: String,
}

impl RemoteXcode {
    /// Bind a host to a remote working directory.
    pub fn new(host: RemoteHost, workdir: impl Into<String>) -> Self {
        RemoteXcode {
            host,
            workdir: workdir.into(),
        }
    }

    /// The full `ssh` argv that would run `xb` remotely — pure, so it can be
    /// shown with `--dry-run` off a Mac.
    pub fn xcodebuild_ssh_args(&self, xb: &Xcodebuild) -> Vec<String> {
        let mut argv = vec!["xcodebuild".to_string()];
        argv.extend(xb.args());
        let refs: Vec<&str> = argv.iter().map(String::as_str).collect();
        let cmd = remote_command_line(&refs, Some(&self.workdir));
        self.host.ssh_args(&cmd)
    }

    /// Run `xcodebuild` on the remote Mac (requires reachability).
    pub fn run_xcodebuild(&self, xb: &Xcodebuild) -> Result<()> {
        let mut argv = vec!["xcodebuild".to_string()];
        argv.extend(xb.args());
        let refs: Vec<&str> = argv.iter().map(String::as_str).collect();
        self.host.run(&refs, Some(&self.workdir))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ontology::{BuildConfiguration, Destination, Platform};
    use crate::xcode::Action;

    #[test]
    fn ssh_uses_lowercase_p_but_scp_uses_uppercase_p_for_the_port() {
        let h = RemoteHost::new("build.mac")
            .user("ci")
            .port(2222)
            .identity("/keys/id_ed25519");
        let ssh = h.ssh_args("true").join(" ");
        assert!(ssh.contains("ssh -p 2222"), "ssh: {ssh}");
        assert!(ssh.contains("-i /keys/id_ed25519"));
        assert!(ssh.contains("ci@build.mac"));

        let scp = h.scp_push_args(Path::new("a.txt"), "~/a.txt", false).join(" ");
        assert!(scp.contains("scp -P 2222"), "scp: {scp}");
        assert!(scp.contains("a.txt ci@build.mac:~/a.txt"));
    }

    #[test]
    fn shell_quote_is_literal_and_handles_embedded_quotes() {
        assert_eq!(shell_quote("simple"), "simple");
        assert_eq!(shell_quote("has space"), "'has space'");
        assert_eq!(shell_quote(""), "''");
        // The nasty case: an embedded single quote.
        assert_eq!(shell_quote("it's"), "'it'\\''s'");
        // A destination with spaces and commas must survive intact.
        assert_eq!(
            shell_quote("platform=iOS Simulator,name=iPhone 15"),
            "'platform=iOS Simulator,name=iPhone 15'"
        );
    }

    #[test]
    fn remote_command_line_prefixes_cd_and_quotes_each_word() {
        let cmd = remote_command_line(&["xcodebuild", "-scheme", "My App"], Some("~/proj"));
        // The workdir keeps its tilde (so it expands remotely); the arg with a
        // space is literally quoted.
        assert_eq!(cmd, "cd ~/proj && xcodebuild -scheme 'My App'");
    }

    #[test]
    fn remote_xcodebuild_wraps_the_command_over_ssh() {
        let rx = RemoteXcode::new(RemoteHost::new("mac.local").user("ci"), "~/Chasm");
        let xb = Xcodebuild::new(Action::Archive)
            .workspace("Chasm.xcworkspace")
            .scheme("Chasm")
            .configuration(BuildConfiguration::Release)
            .destination(Destination::generic(Platform::IOS));
        let args = rx.xcodebuild_ssh_args(&xb);
        let joined = args.join(" ");
        assert!(joined.starts_with("ssh"));
        assert!(joined.contains("ci@mac.local"));
        // The remote command is one quoted word after `--`.
        assert!(joined.contains("cd ~/Chasm && xcodebuild"));
        assert!(joined.contains("-destination generic/platform=iOS archive"));
    }
}
