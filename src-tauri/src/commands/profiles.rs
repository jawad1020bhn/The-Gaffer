use db::manager_profile::{self, ManagerProfile};
use std::path::Path;
use tauri::Manager as TauriManager;

const PROFILES_PATH_ERROR: &str = "be.error.profiles.pathFailed";
/// The wizard no longer asks for a manager birth date. Older profiles keep theirs; a brand-new
/// identity gets a harmless placeholder because the career itself derives the playable age.
const DEFAULT_PROFILE_DOB: &str = "1970-01-01";

fn profiles_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|_| PROFILES_PATH_ERROR.to_string())?;
    Ok(dir.join("profiles.json"))
}


/// A new profile may omit the birth date. Reuse an existing identity's date when the name and
/// nationality already exist, so the old dedup rule still finds it; otherwise store a placeholder.
fn resolve_new_profile_dob(
    path: &Path,
    first_name: &str,
    last_name: &str,
    nationality: &str,
    dob: Option<String>,
) -> Result<String, String> {
    if let Some(dob) = dob {
        return Ok(dob);
    }
    let index = manager_profile::load_profiles(path)?;
    Ok(index
        .profiles
        .iter()
        .find(|profile| {
            profile.first_name == first_name
                && profile.last_name == last_name
                && profile.nationality == nationality
        })
        .map(|profile| profile.date_of_birth.clone())
        .unwrap_or_else(|| DEFAULT_PROFILE_DOB.to_string()))
}

/// Updating a profile from the wizard must not erase a birth date the player can no longer edit.
fn resolve_updated_profile_dob(
    path: &Path,
    id: &str,
    dob: Option<String>,
) -> Result<String, String> {
    if let Some(dob) = dob {
        return Ok(dob);
    }
    let index = manager_profile::load_profiles(path)?;
    Ok(index
        .profiles
        .iter()
        .find(|profile| profile.id == id)
        .map(|profile| profile.date_of_birth.clone())
        .unwrap_or_default())
}

#[tauri::command]
pub fn get_manager_profiles(app_handle: tauri::AppHandle) -> Result<Vec<ManagerProfile>, String> {
    let path = profiles_path(&app_handle)?;
    let mut index = manager_profile::load_profiles(&path)?;
    index.profiles.sort_by(|a, b| {
        let a_date = a.last_used_at.as_deref().unwrap_or(&a.created_at);
        let b_date = b.last_used_at.as_deref().unwrap_or(&b.created_at);
        b_date.cmp(a_date)
    });
    Ok(index.profiles)
}

#[tauri::command]
pub fn touch_manager_profile(app_handle: tauri::AppHandle, id: String) -> Result<bool, String> {
    let path = profiles_path(&app_handle)?;
    manager_profile::touch_profile(&path, &id)
}

#[tauri::command]
pub fn save_manager_profile(
    app_handle: tauri::AppHandle,
    first_name: String,
    last_name: String,
    dob: Option<String>,
    nationality: String,
    force: Option<bool>,
) -> Result<ManagerProfile, String> {
    let path = profiles_path(&app_handle)?;
    let dob = resolve_new_profile_dob(&path, &first_name, &last_name, &nationality, dob)?;
    if force.unwrap_or(false) {
        manager_profile::add_profile_force(&path, first_name, last_name, dob, nationality)
    } else {
        manager_profile::add_profile(&path, first_name, last_name, dob, nationality)
    }
}

#[tauri::command]
pub fn update_manager_profile(
    app_handle: tauri::AppHandle,
    id: String,
    first_name: String,
    last_name: String,
    dob: Option<String>,
    nationality: String,
) -> Result<Option<ManagerProfile>, String> {
    let path = profiles_path(&app_handle)?;
    let dob = resolve_updated_profile_dob(&path, &id, dob)?;
    manager_profile::update_profile(&path, &id, first_name, last_name, dob, nationality)
}

#[tauri::command]
pub fn delete_manager_profile(app_handle: tauri::AppHandle, id: String) -> Result<bool, String> {
    let path = profiles_path(&app_handle)?;
    manager_profile::remove_profile(&path, &id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn omitted_dob_reuses_an_existing_profile_identity() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("profiles.json");
        manager_profile::add_profile(
            &path,
            "José".to_string(),
            "Mourinho".to_string(),
            "1963-01-26".to_string(),
            "PT".to_string(),
        )
        .unwrap();

        let dob = resolve_new_profile_dob(&path, "José", "Mourinho", "PT", None).unwrap();
        assert_eq!(dob, "1963-01-26");
    }

    #[test]
    fn omitted_dob_on_update_preserves_the_stored_date() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("profiles.json");
        let profile = manager_profile::add_profile(
            &path,
            "José".to_string(),
            "Mourinho".to_string(),
            "1963-01-26".to_string(),
            "PT".to_string(),
        )
        .unwrap();

        let dob = resolve_updated_profile_dob(&path, &profile.id, None).unwrap();
        assert_eq!(dob, "1963-01-26");
    }
}
