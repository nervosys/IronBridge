//! Thin wrapper for running subprocesses with useful errors.

use crate::error::{Error, Result};
use std::process::Command;

/// Run `program` with `args`, inheriting stdio, and fail loudly on non-zero
/// exit. Use this for tools whose live output the user should see (compiles).
pub fn run(program: &str, args: &[&str]) -> Result<()> {
    let status = Command::new(program)
        .args(args)
        .status()
        .map_err(|e| Error::io(format!("spawning {program}"), e))?;
    if status.success() {
        Ok(())
    } else {
        Err(Error::CommandFailed {
            program: program.to_string(),
            status: status.to_string(),
            stderr: String::new(),
        })
    }
}

/// Run `program` capturing stdout; fail with captured stderr on non-zero exit.
pub fn capture(program: &str, args: &[&str]) -> Result<String> {
    let out = Command::new(program)
        .args(args)
        .output()
        .map_err(|e| Error::io(format!("spawning {program}"), e))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        Err(Error::CommandFailed {
            program: program.to_string(),
            status: out.status.to_string(),
            stderr: String::from_utf8_lossy(&out.stderr).trim().to_string(),
        })
    }
}
