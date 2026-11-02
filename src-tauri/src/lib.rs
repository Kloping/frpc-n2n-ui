mod profiles;
mod runtime;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .manage(runtime::RuntimeState::default())
    .invoke_handler(tauri::generate_handler![
      profiles::load_profiles,
      profiles::save_profiles,
      runtime::start_profiles,
      runtime::stop_profiles,
      runtime::runtime_snapshot,
      runtime::profile_logs,
      runtime::clear_logs
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    if let tauri::RunEvent::Exit = event
      && let Some(state) = app_handle.try_state::<runtime::RuntimeState>()
    {
      state.stop_all();
    }
  });
}
