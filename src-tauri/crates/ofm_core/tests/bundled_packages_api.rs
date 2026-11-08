use ofm_core::generator::install_bundled_packages;

/// Given a bundled archive and an empty install directory, when the application's public
/// generator API installs it, then the archive is copied without requiring a private module path.
#[test]
fn bundled_packages_can_be_installed_through_the_public_generator_api() {
    let root = std::env::temp_dir().join(format!("ofm-bundled-api-{}", uuid::Uuid::new_v4()));
    let bundled = root.join("bundled");
    let installed = root.join("installed");
    std::fs::create_dir_all(&bundled).expect("creates the source directory");
    std::fs::write(bundled.join("example.ofm"), b"bundled archive").expect("writes the source");

    let copied =
        install_bundled_packages(&bundled, &installed).expect("installs through public API");

    assert_eq!(copied, vec!["example.ofm".to_string()]);
    assert_eq!(
        std::fs::read(installed.join("example.ofm")).expect("reads the installed archive"),
        b"bundled archive"
    );
    std::fs::remove_dir_all(root).expect("removes the fixture");
}
