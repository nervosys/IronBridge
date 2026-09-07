//! The end-to-end orchestrator: (optionally compile) -> bundle -> sign ->
//! package.
//!
//! Each stage is a separate public function so the CLI can run them
//! individually (`bundle`, `sign`, `package`) or as the whole `build` pipeline.

use crate::bundle::AppBundle;
use crate::command::cargo_build_args;
use crate::config::Config;
use crate::error::{Error, Result};
use crate::sdk::Sdk;
use crate::sign::{ldid_sign, DEFAULT_ENTITLEMENTS};
use crate::{ipa, process};
use std::fs;
use std::path::{Path, PathBuf};

/// The artifacts produced by a successful build.
#[derive(Debug)]
pub struct Artifacts {
    /// The assembled `.app` bundle directory.
    pub app: PathBuf,
    /// The packaged `.ipa`, when packaging was requested.
    pub ipa: Option<PathBuf>,
    /// Whether the executable was pseudo-signed.
    pub signed: bool,
}

/// Run the full pipeline described by `config`.
pub fn build(config: &Config) -> Result<Artifacts> {
    config.validate()?;
    // Validate the SDK against the target up front — the most common failure.
    let sdk = Sdk::validate(&config.sdk_path, config.target)?;

    // 1. Obtain the executable: either the prebuilt one or by compiling.
    let executable = match (&config.executable, &config.crate_dir) {
        (Some(exe), _) => exe.clone(),
        (None, Some(dir)) => compile_rust_crate(dir, config)?,
        (None, None) => unreachable!("validated above"),
    };

    // 2. Assemble the .app bundle.
    fs::create_dir_all(&config.out_dir)
        .map_err(|e| Error::io(format!("creating {}", config.out_dir.display()), e))?;
    let bundle = AppBundle::create(&config.out_dir, &config.meta, config.target)?;
    bundle.install_executable(&executable)?;
    for res in &config.resources {
        bundle.add_resource(res)?;
    }
    let _ = &sdk; // sysroot already validated; kept for future resource copies

    // 3. Pseudo-sign (unless skipped).
    let mut signed = false;
    if !config.skip_sign {
        let ent_path = resolve_entitlements(config)?;
        ldid_sign(&bundle.executable_path(), ent_path.as_deref())?;
        signed = true;
    }

    // 4. Package the .ipa.
    let ipa_path = config
        .out_dir
        .join(format!("{}.ipa", config.meta.display_name));
    ipa::package(bundle.path(), &ipa_path)?;

    Ok(Artifacts {
        app: bundle.path().to_path_buf(),
        ipa: Some(ipa_path),
        signed,
    })
}

/// `cargo build` the crate for the iOS target and return the produced binary.
fn compile_rust_crate(crate_dir: &Path, config: &Config) -> Result<PathBuf> {
    let args = cargo_build_args(config.target, config.release, &[]);
    let args_ref: Vec<&str> = args.iter().map(String::as_str).collect();

    // Run cargo from within the crate directory.
    let mut cmd = std::process::Command::new("cargo");
    cmd.args(&args_ref).current_dir(crate_dir);
    let status = cmd
        .status()
        .map_err(|e| Error::io("spawning cargo", e))?;
    if !status.success() {
        return Err(Error::CommandFailed {
            program: "cargo".into(),
            status: status.to_string(),
            stderr: String::new(),
        });
    }

    // Locate the produced binary under target/<triple>/<profile>/<name>.
    let profile = if config.release { "release" } else { "debug" };
    let candidate = crate_dir
        .join("target")
        .join(config.target.rust_triple())
        .join(profile)
        .join(&config.meta.executable);
    if candidate.is_file() {
        Ok(candidate)
    } else {
        Err(Error::InvalidInput(format!(
            "cargo build succeeded but the expected binary {} was not found; \
             set --executable-name to the crate's binary name",
            candidate.display()
        )))
    }
}

/// Materialize the entitlements plist to a temp file, using the caller's file
/// if given, else the default ad-hoc entitlements.
fn resolve_entitlements(config: &Config) -> Result<Option<PathBuf>> {
    if let Some(p) = &config.entitlements {
        return Ok(Some(p.clone()));
    }
    let path = config.out_dir.join(".xcross-entitlements.plist");
    fs::write(&path, DEFAULT_ENTITLEMENTS)
        .map_err(|e| Error::io(format!("writing {}", path.display()), e))?;
    Ok(Some(path))
}

/// Just assemble a `.app` from a prebuilt executable (no compile/sign/package).
pub fn bundle_only(config: &Config) -> Result<PathBuf> {
    config.validate()?;
    let exe = config
        .executable
        .as_ref()
        .ok_or_else(|| Error::InvalidInput("bundle requires --executable".into()))?;
    fs::create_dir_all(&config.out_dir)
        .map_err(|e| Error::io(format!("creating {}", config.out_dir.display()), e))?;
    let bundle = AppBundle::create(&config.out_dir, &config.meta, config.target)?;
    bundle.install_executable(exe)?;
    for res in &config.resources {
        bundle.add_resource(res)?;
    }
    Ok(bundle.path().to_path_buf())
}

/// Package an existing `.app` directory into an `.ipa`.
pub fn package_only(app_dir: &Path, ipa_path: &Path) -> Result<()> {
    ipa::package(app_dir, ipa_path)
}

/// Report a single tool run's output (used by the CLI for `ldid -v` etc).
pub fn tool_version(program: &str, arg: &str) -> Result<String> {
    process::capture(program, &[arg])
}
