include!("build_revision.rs");

fn main() {
    pack_bundled_world();
    tauri_build::build();
    embed_source_revision();
}

/// Packs the world every build ships, before `tauri_build` looks for it.
///
/// `tauri.conf.json` declares `packages/eafc-fc27.ofm` as a resource and tauri-build fails on a
/// declared resource that is not there. The archive is generated and gitignored, so a fresh
/// checkout has none — and `cargo test --workspace`, which is how CI's backend job builds this
/// crate, never runs npm. Doing it here rather than in each workflow is what stops "remember to
/// pack the world first" from being an invariant a contributor has to know: every path that
/// compiles this crate comes through this function.
///
/// The packer is plain Node with no dependencies, so this needs Node on PATH and nothing else —
/// no `npm ci`, no warm toolchain. Building the app already requires Node for `../dist`, so this
/// adds no new requirement. An unchanged run costs well under a tenth of a second.
///
/// The archive lands in a gitignored directory on purpose for a second reason: the tauri dev
/// watcher respects .gitignore, so writing it does not restart the app mid-session.
fn pack_bundled_world() {
    println!("cargo:rerun-if-changed=../mods/eafc-fc27");
    println!("cargo:rerun-if-changed=../scripts/pack-bundled-world.mjs");

    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let repo_root = manifest_dir.parent().expect("src-tauri has a parent");
    let packed = manifest_dir.join("packages").join("eafc-fc27.ofm");

    // Captured rather than inherited: a build script's stdout is a protocol cargo parses, and
    // the packer's own progress line does not belong in it.
    let outcome = std::process::Command::new("node")
        .arg("scripts/pack-bundled-world.mjs")
        .current_dir(repo_root)
        .output();

    let problem = match &outcome {
        Ok(output) if output.status.success() => None,
        Ok(output) => Some(format!(
            "pack-bundled-world exited with {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr).trim()
        )),
        Err(err) => Some(format!("could not run node: {err}")),
    };

    if let Some(problem) = problem {
        // A stale world still builds, and saying so beats refusing to compile over it.
        if packed.is_file() {
            println!(
                "cargo:warning={problem}; building with the world already packed, \
                 which may be out of date"
            );
        } else {
            panic!(
                "{problem}. Building the app needs Node on PATH. \
                 Run `npm run world:pack` from the repository root to see the error."
            );
        }
    }
}
