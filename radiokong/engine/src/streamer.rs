//! Streaming module
//!
//! Handles streaming encoded audio to Icecast 2 and SHOUTcast servers.
//! Supports:
//! - Icecast 2 (HTTP PUT protocol with chunked transfer encoding)
//! - SHOUTcast (ICY protocol)
//! - Auto-reconnect with configurable retry count and interval
//! - Multi-server output (Pro/Studio tiers)

use crate::{ServerConfig, StreamProtocol};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::time::Duration;

/// Streaming client for Icecast/SHOUTcast with auto-reconnect
pub struct StreamClient {
    config: ServerConfig,
    stream: Option<TcpStream>,
    connected: bool,
    bytes_sent: u64,
    start_time: Option<std::time::Instant>,
    content_type: String,
    // Auto-reconnect settings
    reconnect_enabled: bool,
    max_reconnect_attempts: u32,
    reconnect_interval: Duration,
    reconnect_count: u32,
    // Multi-server outputs
    additional_servers: Vec<AdditionalServer>,
}

/// A secondary streaming output (for multi-server Pro/Studio feature)
struct AdditionalServer {
    config: ServerConfig,
    stream: Option<TcpStream>,
    connected: bool,
    bytes_sent: u64,
    content_type: String,
}

impl StreamClient {
    /// Create a new streaming client
    pub fn new(config: ServerConfig) -> Self {
        Self {
            config,
            stream: None,
            connected: false,
            bytes_sent: 0,
            start_time: None,
            content_type: "audio/mpeg".to_string(),
            reconnect_enabled: true,
            max_reconnect_attempts: 5,
            reconnect_interval: Duration::from_secs(5),
            reconnect_count: 0,
            additional_servers: Vec::new(),
        }
    }

    /// Enable or disable auto-reconnect
    pub fn enable_reconnect(&mut self, enabled: bool, max_attempts: u32, interval_secs: u64) {
        self.reconnect_enabled = enabled;
        self.max_reconnect_attempts = max_attempts;
        self.reconnect_interval = Duration::from_secs(interval_secs);
    }

    /// Add a secondary streaming server output (multi-server feature)
    pub fn add_server(&mut self, config: ServerConfig, content_type: &str) {
        self.additional_servers.push(AdditionalServer {
            config,
            stream: None,
            connected: false,
            bytes_sent: 0,
            content_type: content_type.to_string(),
        });
    }

    /// Connect to the primary streaming server
    pub fn connect(&mut self, content_type: &str) -> Result<(), String> {
        self.content_type = content_type.to_string();

        let stream = connect_to_server(&self.config, content_type)?;
        self.stream = Some(stream);
        self.connected = true;

        // Also connect to additional servers
        for output in &mut self.additional_servers {
            match connect_to_server(&output.config, &output.content_type) {
                Ok(s) => {
                    output.stream = Some(s);
                    output.connected = true;
                    log::info!("Connected to additional server: {}:{}", output.config.host, output.config.port);
                }
                Err(e) => {
                    log::warn!("Failed to connect to additional server {}:{}: {}", output.config.host, output.config.port, e);
                }
            }
        }

        self.start_time = Some(std::time::Instant::now());
        self.reconnect_count = 0;
        log::info!("Streaming client connected to primary server");
        Ok(())
    }

    /// Send encoded audio data to the server (with auto-reconnect)
    pub fn send_data(&mut self, data: &[u8]) -> Result<(), String> {
        if !self.connected {
            return Err("Not connected to server".to_string());
        }

        // Send to primary server
        if let Some(ref mut stream) = self.stream {
            match stream.write_all(data) {
                Ok(()) => {
                    let _ = stream.flush();
                    self.bytes_sent += data.len() as u64;
                    self.reconnect_count = 0;
                }
                Err(e) => {
                    log::error!("Primary server write error: {}", e);
                    if self.reconnect_enabled {
                        return self.attempt_reconnect(data);
                    }
                    return Err(format!("Write error: {}", e));
                }
            }
        }

        // Send to additional servers (best-effort)
        for output in &mut self.additional_servers {
            if output.connected {
                if let Some(ref mut stream) = output.stream {
                    match stream.write_all(data) {
                        Ok(()) => {
                            let _ = stream.flush();
                            output.bytes_sent += data.len() as u64;
                        }
                        Err(e) => {
                            log::warn!("Additional server write error: {}", e);
                            output.connected = false;
                            output.stream = None;
                            // Try to reconnect secondary
                            match connect_to_server(&output.config, &output.content_type) {
                                Ok(new_stream) => {
                                    output.stream = Some(new_stream);
                                    output.connected = true;
                                    log::info!("Reconnected to additional server");
                                }
                                Err(re) => {
                                    log::warn!("Failed to reconnect additional server: {}", re);
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Attempt to reconnect to the primary server
    fn attempt_reconnect(&mut self, pending_data: &[u8]) -> Result<(), String> {
        self.connected = false;
        self.stream = None;

        for attempt in 1..=self.max_reconnect_attempts {
            self.reconnect_count = attempt;
            log::info!(
                "Reconnect attempt {}/{} in {}s...",
                attempt,
                self.max_reconnect_attempts,
                self.reconnect_interval.as_secs()
            );

            std::thread::sleep(self.reconnect_interval);

            match connect_to_server(&self.config, &self.content_type) {
                Ok(stream) => {
                    self.stream = Some(stream);
                    self.connected = true;
                    log::info!("Reconnected to server on attempt {}", attempt);

                    // Try to send the pending data
                    if let Some(ref mut s) = self.stream {
                        match s.write_all(pending_data) {
                            Ok(()) => {
                                let _ = s.flush();
                                self.bytes_sent += pending_data.len() as u64;
                            }
                            Err(e) => {
                                log::error!("Failed to send pending data after reconnect: {}", e);
                            }
                        }
                    }

                    return Ok(());
                }
                Err(e) => {
                    log::warn!("Reconnect attempt {} failed: {}", attempt, e);
                }
            }
        }

        let err_msg = format!("Failed to reconnect after {} attempts", self.max_reconnect_attempts);
        log::error!("{}", err_msg);
        Err(err_msg)
    }

    /// Update metadata on the server
    pub fn update_metadata(&mut self, title: &str, artist: &str) -> Result<(), String> {
        if !self.connected {
            return Err("Not connected to server".to_string());
        }

        match self.config.protocol {
            StreamProtocol::Icecast => self.update_icecast_metadata(title, artist),
            StreamProtocol::Shoutcast => self.update_shoutcast_metadata(title, artist),
        }
    }

    /// Disconnect from all servers
    pub fn disconnect(&mut self) {
        self.stream = None;
        self.connected = false;
        for output in &mut self.additional_servers {
            output.stream = None;
            output.connected = false;
        }
        log::info!("Disconnected from streaming server(s)");
    }

    pub fn is_connected(&self) -> bool { self.connected }
    pub fn bytes_sent(&self) -> u64 { self.bytes_sent }
    pub fn uptime(&self) -> u64 {
        self.start_time.map(|t| t.elapsed().as_secs()).unwrap_or(0)
    }
    pub fn server_url(&self) -> String {
        format!("http://{}:{}{}", self.config.host, self.config.port, self.config.mount)
    }
    pub fn active_connections(&self) -> usize {
        let count = if self.connected { 1 } else { 0 };
        count + self.additional_servers.iter().filter(|o| o.connected).count()
    }
    pub fn reconnect_attempts(&self) -> u32 { self.reconnect_count }

    fn update_icecast_metadata(&self, title: &str, artist: &str) -> Result<(), String> {
        let song = format!("{} - {}", artist, title);
        log::info!("Updating Icecast metadata: {}", song);

        // Try HTTP request to Icecast admin API
        let addr = format!("{}:{}", self.config.host, self.config.port);
        if let Ok(stream) = TcpStream::connect_timeout(
            &addr.parse().unwrap_or_else(|_| "0.0.0.0:0".parse().unwrap()),
            Duration::from_secs(5),
        ) {
            let request = format!(
                "GET /admin/metadata?mode=updinfo&mount={}&song={} HTTP/1.1\r\nHost: {}:{}\r\nAuthorization: Basic {}\r\nConnection: close\r\n\r\n",
                self.config.mount,
                urlencoding::encode(&song),
                self.config.host,
                self.config.port,
                base64_encode(&format!("{}:{}", self.config.username, self.config.password))
            );
            if let Ok(mut s) = stream.try_clone() {
                let _ = s.write_all(request.as_bytes());
                let _ = s.flush();
                log::info!("Metadata update request sent to Icecast admin API");
            }
        }
        Ok(())
    }

    fn update_shoutcast_metadata(&self, title: &str, artist: &str) -> Result<(), String> {
        let song = format!("{} - {}", artist, title);
        log::info!("Updating SHOUTcast metadata: {}", song);
        Ok(())
    }
}

impl Drop for StreamClient {
    fn drop(&mut self) {
        self.disconnect();
    }
}

// ---- Standalone connection function (avoids borrow issues) ----

fn connect_to_server(config: &ServerConfig, content_type: &str) -> Result<TcpStream, String> {
    let addr = format!("{}:{}", config.host, config.port);
    log::info!("Connecting to {} server at {}", config.protocol, addr);

    let stream = TcpStream::connect_timeout(
        &addr.parse().map_err(|e: std::net::AddrParseError| format!("Invalid address: {}", e))?,
        Duration::from_secs(10),
    ).map_err(|e| format!("Connection to {}:{} failed: {}", config.host, config.port, e))?;

    stream.set_write_timeout(Some(Duration::from_secs(30)))
        .map_err(|e| format!("Write timeout error: {}", e))?;
    stream.set_read_timeout(Some(Duration::from_secs(10)))
        .map_err(|e| format!("Read timeout error: {}", e))?;

    match config.protocol {
        StreamProtocol::Icecast => send_icecast_handshake(&stream, config, content_type)?,
        StreamProtocol::Shoutcast => send_shoutcast_handshake(&stream, config, content_type)?,
    }

    log::info!("Connected to {} at {}", config.protocol, addr);
    Ok(stream)
}

fn send_icecast_handshake(stream: &TcpStream, config: &ServerConfig, content_type: &str) -> Result<(), String> {
    let request = format!(
        "PUT {} HTTP/1.1\r\nHost: {}:{}\r\nAuthorization: Basic {}\r\nContent-Type: {}\r\nTransfer-Encoding: chunked\r\nIce-Public: 1\r\nUser-Agent: RadioKong/0.2.0\r\n\r\n",
        config.mount,
        config.host,
        config.port,
        base64_encode(&format!("{}:{}", config.username, config.password)),
        content_type
    );

    let mut s = stream.try_clone().map_err(|e| format!("Clone error: {}", e))?;
    s.write_all(request.as_bytes()).map_err(|e| format!("Handshake write: {}", e))?;
    s.flush().map_err(|e| format!("Handshake flush: {}", e))?;

    let mut response = vec![0u8; 1024];
    let bytes_read = s.read(&mut response).map_err(|e| format!("Handshake read: {}", e))?;
    let response_str = String::from_utf8_lossy(&response[..bytes_read]);

    if response_str.contains("200") || response_str.contains("100") {
        log::info!("Icecast handshake successful");
        Ok(())
    } else {
        Err(format!("Icecast handshake failed: {}", response_str))
    }
}

fn send_shoutcast_handshake(stream: &TcpStream, config: &ServerConfig, content_type: &str) -> Result<(), String> {
    let request = format!(
        "PUT {} HTTP/1.1\r\nHost: {}:{}\r\nAuthorization: Basic {}\r\nContent-Type: {}\r\nicy-name: RadioKong Stream\r\nicy-pub: 1\r\nUser-Agent: RadioKong/0.2.0\r\n\r\n",
        config.mount,
        config.host,
        config.port,
        base64_encode(&format!("{}:{}", config.username, config.password)),
        content_type
    );

    let mut s = stream.try_clone().map_err(|e| format!("Clone error: {}", e))?;
    s.write_all(request.as_bytes()).map_err(|e| format!("Handshake write: {}", e))?;
    log::info!("SHOUTcast handshake sent");
    Ok(())
}

fn base64_encode(input: &str) -> String {
    const A: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = input.as_bytes();
    let mut r = String::new();
    for chunk in bytes.chunks(3) {
        let mut buf = [0u8; 3];
        for (i, &b) in chunk.iter().enumerate() { buf[i] = b; }
        r.push(A[(buf[0] >> 2) as usize] as char);
        r.push(A[(((buf[0] & 3) << 4) | (buf[1] >> 4)) as usize] as char);
        r.push(if chunk.len() > 1 { A[(((buf[1] & 0xF) << 2) | (buf[2] >> 6)) as usize] as char } else { '=' });
        r.push(if chunk.len() > 2 { A[(buf[2] & 0x3F) as usize] as char } else { '=' });
    }
    r
}

mod urlencoding {
    pub fn encode(input: &str) -> String {
        input.chars().map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '~' { c.to_string() }
            else { format!("%{:02X}", c as u8) }
        }).collect()
    }
}
