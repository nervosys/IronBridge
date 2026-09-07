//! Assembles a `.app` bundle directory on disk.
//!
//! An iOS `.app` is a flat directory (unlike a macOS `.app`, there is no
//! `Contents/`): the Mach-O executable and `Info.plist` sit at the top, with
//! resources alongside. This module lays that out deterministically so the same
//! inputs always produce the same bundle.

use crate::error::{Error, Result};
use crate::plist::{render_info_plist, AppMetadata};
use crate::target::Target;
use std::fs;
use std::path::{Path, PathBuf};

/// A `.app` bundle being built under some output directory.
#[derive(Debug)]
pub struct AppBundle {
    app_dir: PathBuf,
    executable: String,
}

impl AppBundle {
    /// Create `<out_dir>/<DisplayName>.app`, write its `Info.plist`, and return
    /// a handle for adding the executable and resources.
    pub fn create(out_dir: &Path, meta: &AppMetadata, target: Target) -> Result<AppBundle> {
        meta.validate()?;
        let app_dir = out_dir.join(format!("{}.app", meta.display_name));
        fs::create_dir_all(&app_dir)
            .map_err(|e| Error::io(format!("creating {}", app_dir.display()), e))?;
        let plist = render_info_plist(meta, target)?;
        let plist_path = app_dir.join("Info.plist");
        fs::write(&plist_path, plist)
            .map_err(|e| Error::io(format!("writing {}", plist_path.display()), e))?;
        Ok(AppBundle {
            app_dir,
            executable: meta.executable.clone(),
        })
    }

    /// The bundle directory.
    pub fn path(&self) -> &Path {
        &self.app_dir
    }

    /// The path the main executable should live at inside the bundle.
    pub fn executable_path(&self) -> PathBuf {
        self.app_dir.join(&self.executable)
    }

    /// Copy the compiled Mach-O executable into the bundle under the
    /// `CFBundleExecutable` name.
    pub fn install_executable(&self, from: &Path) -> Result<()> {
        if !from.is_file() {
            return Err(Error::InvalidInput(format!(
                "executable {} does not exist",
                from.display()
            )));
        }
        let dst = self.executable_path();
        fs::copy(from, &dst)
            .map_err(|e| Error::io(format!("copying executable to {}", dst.display()), e))?;
        Ok(())
    }

    /// Copy a resource file or directory tree into the bundle root.
    pub fn add_resource(&self, from: &Path) -> Result<()> {
        let name = from
            .file_name()
            .ok_or_else(|| Error::InvalidInput("resource has no file name".into()))?;
        let dst = self.app_dir.join(name);
        copy_recursive(from, &dst)
    }
}

/// Copy a file, or a directory tree, from `src` to `dst`.
pub fn copy_recursive(src: &Path, dst: &Path) -> Result<()> {
    if src.is_dir() {
        fs::create_dir_all(dst)
            .map_err(|e| Error::io(format!("creating {}", dst.display()), e))?;
        for entry in
            fs::read_dir(src).map_err(|e| Error::io(format!("reading {}", src.display()), e))?
        {
            let entry = entry.map_err(|e| Error::io("reading dir entry", e))?;
            copy_recursive(&entry.path(), &dst.join(entry.file_name()))?;
        }
        Ok(())
    } else {
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| Error::io(format!("creating {}", parent.display()), e))?;
        }
        fs::copy(src, dst)
            .map_err(|e| Error::io(format!("copying {} -> {}", src.display(), dst.display()), e))?;
        Ok(())
    }
}
