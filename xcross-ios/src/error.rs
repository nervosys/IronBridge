//! Error type shared across the crate.

use std::fmt;
use std::path::PathBuf;

/// The crate's result alias.
pub type Result<T> = std::result::Result<T, Error>;

/// Everything that can go wrong assembling an iOS build off a Mac.
#[derive(Debug)]
pub enum Error {
    /// A required external tool was not found on `PATH`.
    ToolMissing {
        /// The tool's canonical name (e.g. `clang`).
        tool: String,
        /// Why it is needed / how to get it.
        hint: String,
    },
    /// The iOS SDK sysroot the user pointed us at is missing or malformed.
    InvalidSdk {
        /// The path we were given.
        path: PathBuf,
        /// What was wrong with it.
        reason: String,
    },
    /// A subprocess ran but exited non-zero.
    CommandFailed {
        /// The program invoked.
        program: String,
        /// Its exit status, rendered.
        status: String,
        /// Captured stderr, trimmed.
        stderr: String,
    },
    /// A value supplied by the caller did not validate.
    InvalidInput(String),
    /// An I/O error, annotated with the path in play.
    Io {
        /// What we were doing.
        context: String,
        /// The underlying error.
        source: std::io::Error,
    },
}

impl Error {
    /// Wrap an [`std::io::Error`] with a human-readable context string.
    pub fn io(context: impl Into<String>, source: std::io::Error) -> Self {
        Error::Io {
            context: context.into(),
            source,
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::ToolMissing { tool, hint } => {
                write!(f, "required tool `{tool}` was not found on PATH: {hint}")
            }
            Error::InvalidSdk { path, reason } => {
                write!(f, "invalid iOS SDK at {}: {reason}", path.display())
            }
            Error::CommandFailed {
                program,
                status,
                stderr,
            } => {
                if stderr.is_empty() {
                    write!(f, "`{program}` failed ({status})")
                } else {
                    write!(f, "`{program}` failed ({status}):\n{stderr}")
                }
            }
            Error::InvalidInput(msg) => write!(f, "invalid input: {msg}"),
            Error::Io { context, source } => write!(f, "{context}: {source}"),
        }
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Error::Io { source, .. } => Some(source),
            _ => None,
        }
    }
}
