//! The `ship` orchestrator: chain the whole iOS release pipeline into one
//! ordered, inspectable plan.
//!
//! It composes the crate's building blocks — a remote-Mac `xcodebuild archive`,
//! `-exportArchive` to an `.ipa`, an `scp` pull back to the local host, and a
//! `codesign` verify — into a [`ShipPlan`] of [`Step`]s. Planning is pure: every
//! step, its host (local vs the Mac), and its exact command are computed without
//! running anything, so `ship --dry-run` shows the full plan on Windows and
//! `execute` runs it where each step belongs.

use crate::codesign;
use crate::error::{Error, Result};
use crate::ontology::{BuildConfiguration, Destination, Platform};
use crate::process;
use crate::remote::{remote_command_line, RemoteHost};
use crate::xcode::{Action, ProjectRef, Xcodebuild};

/// Where a step runs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Host {
    /// This machine (Windows/Linux).
    Local,
    /// The remote Mac, over SSH.
    RemoteMac,
}

impl Host {
    fn label(self) -> &'static str {
        match self {
            Host::Local => "local",
            Host::RemoteMac => "mac",
        }
    }
}

/// One step of the pipeline: a program + args on a given host.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Step {
    /// A short name (`archive`, `export`, `pull`, `verify`).
    pub name: &'static str,
    /// Where it runs.
    pub host: Host,
    /// The program to invoke.
    pub program: String,
    /// Its arguments.
    pub args: Vec<String>,
    /// One-line description.
    pub note: String,
}

impl Step {
    /// Render as a shell-ish command line for display.
    pub fn render(&self) -> String {
        let mut parts = vec![self.program.clone()];
        parts.extend(self.args.iter().cloned());
        crate::pipeline::shell_join(&parts)
    }
}

/// Everything needed to plan a remote-Mac ship.
#[derive(Debug, Clone)]
pub struct ShipConfig {
    /// The Mac to build on.
    pub host: RemoteHost,
    /// The remote directory the project lives in.
    pub workdir: String,
    /// Workspace or project.
    pub project: ProjectRef,
    /// Scheme to archive.
    pub scheme: String,
    /// Build configuration.
    pub configuration: BuildConfiguration,
    /// Remote path for the `.xcarchive`.
    pub archive_path: String,
    /// Remote path to an `ExportOptions.plist`.
    pub export_options_plist: String,
    /// Remote directory the `.ipa` is exported into.
    pub export_path: String,
    /// The exported `.ipa` file name (to pull).
    pub ipa_name: String,
    /// Local directory to pull the `.ipa` into.
    pub pull_to: String,
    /// Also `codesign --verify` the archived app.
    pub verify: bool,
    /// Remote path of the `.app` to verify (inside the archive), if `verify`.
    pub verify_bundle: Option<String>,
}

/// An ordered, inspectable pipeline.
#[derive(Debug, Clone)]
pub struct ShipPlan {
    /// The steps, in execution order.
    pub steps: Vec<Step>,
}

impl ShipPlan {
    /// Compute the plan from a config — pure, no execution.
    pub fn plan(cfg: &ShipConfig) -> ShipPlan {
        let mut steps = Vec::new();

        // 1. Archive on the Mac.
        let mut xb = Xcodebuild::new(Action::Archive)
            .scheme(cfg.scheme.clone())
            .configuration(cfg.configuration.clone())
            .destination(Destination::generic(Platform::IOS));
        xb.project = Some(cfg.project.clone());
        xb.archive_path = Some(cfg.archive_path.clone().into());
        steps.push(ssh_step(
            "archive",
            &cfg.host,
            &cfg.workdir,
            {
                let mut a = vec!["xcodebuild".to_string()];
                a.extend(xb.args());
                a
            },
            "xcodebuild archive on the Mac",
        ));

        // 2. Export the .ipa from the archive.
        let export_argv = vec![
            "xcodebuild".to_string(),
            "-exportArchive".to_string(),
            "-archivePath".to_string(),
            cfg.archive_path.clone(),
            "-exportPath".to_string(),
            cfg.export_path.clone(),
            "-exportOptionsPlist".to_string(),
            cfg.export_options_plist.clone(),
        ];
        steps.push(ssh_step(
            "export",
            &cfg.host,
            &cfg.workdir,
            export_argv,
            "xcodebuild -exportArchive -> .ipa",
        ));

        // 3. Pull the .ipa back to the local host.
        let remote_ipa = format!("{}/{}", cfg.export_path.trim_end_matches('/'), cfg.ipa_name);
        let scp = cfg
            .host
            .scp_pull_args(&remote_ipa, std::path::Path::new(&cfg.pull_to), false);
        steps.push(Step {
            name: "pull",
            host: Host::RemoteMac,
            program: scp[0].clone(),
            args: scp[1..].to_vec(),
            note: format!("scp the .ipa to {}", cfg.pull_to),
        });

        // 4. Optionally verify the signature on the Mac.
        if cfg.verify {
            if let Some(bundle) = &cfg.verify_bundle {
                let mut argv = vec!["codesign".to_string()];
                argv.extend(codesign::verify_args(bundle));
                steps.push(ssh_step(
                    "verify",
                    &cfg.host,
                    &cfg.workdir,
                    argv,
                    "codesign --verify the archived app",
                ));
            }
        }

        ShipPlan { steps }
    }

    /// Render the plan as a numbered list for `--dry-run`.
    pub fn render(&self) -> String {
        let mut out = String::new();
        for (i, s) in self.steps.iter().enumerate() {
            out.push_str(&format!(
                "{}. [{}] {}\n     {}\n",
                i + 1,
                s.host.label(),
                s.note,
                s.render()
            ));
        }
        out
    }

    /// Execute the steps in order, stopping at the first failure.
    pub fn execute(&self) -> Result<()> {
        for s in &self.steps {
            let refs: Vec<&str> = s.args.iter().map(String::as_str).collect();
            process::run(&s.program, &refs).map_err(|e| {
                Error::InvalidInput(format!("step `{}` failed: {e}", s.name))
            })?;
        }
        Ok(())
    }
}

/// Build an SSH step that runs `argv` in `workdir` on the Mac.
fn ssh_step(
    name: &'static str,
    host: &RemoteHost,
    workdir: &str,
    argv: Vec<String>,
    note: &str,
) -> Step {
    let refs: Vec<&str> = argv.iter().map(String::as_str).collect();
    let remote_cmd = remote_command_line(&refs, Some(workdir));
    let ssh = host.ssh_args(&remote_cmd);
    Step {
        name,
        host: Host::RemoteMac,
        program: ssh[0].clone(),
        args: ssh[1..].to_vec(),
        note: note.to_string(),
    }
}

/// Join args for display, quoting any that contain spaces.
pub(crate) fn shell_join(args: &[String]) -> String {
    args.iter()
        .map(|a| {
            if a.contains(' ') {
                format!("\"{a}\"")
            } else {
                a.clone()
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg() -> ShipConfig {
        ShipConfig {
            host: RemoteHost::new("mac.local").user("ci"),
            workdir: "~/Chasm".into(),
            project: ProjectRef::Workspace("Chasm.xcworkspace".into()),
            scheme: "Chasm".into(),
            configuration: BuildConfiguration::Release,
            // Paths are relative to the remote workdir (they resolve after the
            // `cd`), so they carry no `~`/spaces and are not shell-quoted —
            // which matters because xcodebuild is not a shell and would not
            // expand a `~` itself.
            archive_path: "build/Chasm.xcarchive".into(),
            export_options_plist: "build/ExportOptions.plist".into(),
            export_path: "build/export".into(),
            ipa_name: "Chasm.ipa".into(),
            pull_to: "dist".into(),
            verify: true,
            verify_bundle: Some("build/Chasm.xcarchive/Products/Applications/Chasm.app".into()),
        }
    }

    #[test]
    fn plan_has_the_four_steps_in_order() {
        let plan = ShipPlan::plan(&cfg());
        let names: Vec<_> = plan.steps.iter().map(|s| s.name).collect();
        assert_eq!(names, vec!["archive", "export", "pull", "verify"]);
    }

    #[test]
    fn archive_step_is_an_ssh_xcodebuild_archive() {
        let plan = ShipPlan::plan(&cfg());
        let archive = plan.steps.iter().find(|s| s.name == "archive").unwrap();
        assert_eq!(archive.program, "ssh");
        assert_eq!(archive.host, Host::RemoteMac);
        let rendered = archive.render();
        assert!(rendered.contains("ci@mac.local"));
        assert!(rendered.contains("cd ~/Chasm && xcodebuild"));
        assert!(rendered.contains("-scheme Chasm"));
        assert!(rendered.contains("-archivePath build/Chasm.xcarchive"));
        assert!(rendered.contains("archive"));
    }

    #[test]
    fn export_step_calls_exportarchive_with_the_options_plist() {
        let plan = ShipPlan::plan(&cfg());
        let export = plan.steps.iter().find(|s| s.name == "export").unwrap();
        let r = export.render();
        assert!(r.contains("-exportArchive"));
        assert!(r.contains("-exportOptionsPlist build/ExportOptions.plist"));
        assert!(r.contains("-exportPath build/export"));
    }

    #[test]
    fn pull_step_scps_the_ipa_down() {
        let plan = ShipPlan::plan(&cfg());
        let pull = plan.steps.iter().find(|s| s.name == "pull").unwrap();
        assert_eq!(pull.program, "scp");
        let r = pull.render();
        // scp pulls remote:path -> local dir.
        assert!(r.contains("ci@mac.local:build/export/Chasm.ipa"));
        assert!(r.contains("dist"));
    }

    #[test]
    fn verify_can_be_omitted() {
        let mut c = cfg();
        c.verify = false;
        let plan = ShipPlan::plan(&c);
        assert!(plan.steps.iter().all(|s| s.name != "verify"));
        assert_eq!(plan.steps.len(), 3);
    }
}
