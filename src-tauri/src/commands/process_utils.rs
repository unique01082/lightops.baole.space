use std::{
    process::{Command, Output, Stdio},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};
use wait_timeout::ChildExt;

pub fn output_with_timeout(
    command: &mut Command,
    timeout: Duration,
    label: &str,
) -> Result<Output, String> {
    output_with_timeout_cancellable(command, timeout, label, None)
}

pub fn output_with_timeout_cancellable(
    command: &mut Command,
    timeout: Duration,
    label: &str,
    cancelled: Option<&AtomicBool>,
) -> Result<Output, String> {
    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not start {label}: {error}"))?;

    let started = Instant::now();
    loop {
        if cancelled.is_some_and(|flag| flag.load(Ordering::Relaxed)) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("{label} was cancelled"));
        }
        if started.elapsed() >= timeout {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!(
                "{label} timed out after {} seconds and was stopped",
                timeout.as_secs()
            ));
        }
        let remaining = timeout.saturating_sub(started.elapsed());
        let poll = remaining.min(Duration::from_millis(100));
        if child
            .wait_timeout(poll)
            .map_err(|error| format!("Could not monitor {label}: {error}"))?
            .is_some()
        {
            return child
                .wait_with_output()
                .map_err(|error| format!("Could not read {label} output: {error}"));
        }
    }
}
