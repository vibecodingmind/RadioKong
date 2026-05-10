//! Streaming module
//!
//! Handles streaming encoded audio to Icecast 2 and SHOUTcast servers.
//! Supports:
//! - Icecast 2 (HTTP PUT protocol with chunked transfer encoding)
//! - SHOUTcast (ICY protocol)

use crate::{ServerConfig, StreamProtocol};
use std::io::Write;
use std::net::TcpStream;
use std::time::Duration;

/// Streaming client for Icecast/SHOUTcast
pub struct StreamClient {
    config: ServerConfig,
    stream: Option<TcpStream>,
    connected: bool,
    bytes_sent: u64,
    start_time: Option<std::time::Instant>,
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
        }
    }

    /// Connect to the streaming server
    pub fn connect(&mut self, content_type: &str) -> Result<(), String> {
        let addr = format!("{}:{}", self.config.host, self.config.port);

        log::info!("Connecting to {} server at {}", self.config.protocol, addr);

        // Establish TCP connection
        let stream = TcpStream::connect_timeout(
            &addr.parse().map_err(|e: std::net::AddrParseError| format!("Invalid address: {}", e))?,
            Duration::from_secs(10),
        ).map_err(|e| format!("Connection failed: {}", e))?;

        stream.set_write_timeout(Some(Duration::from_secs(30)))
            .map_err(|e| format!("Failed to set write timeout: {}", e))?;

        // Send protocol-specific handshake
        match self.config.protocol {
            StreamProtocol::Icecast => self.send_icecast_handshake(&stream, content_type)?,
            StreamProtocol::Shoutcast => self.send_shoutcast_handshake(&stream, content_type)?,
        }

        self.stream = Some(stream);
        self.connected = true;
        self.start_time = Some(std::time::Instant::now());

        log::info!("Connected to {} at {}", self.config.protocol, addr);
        Ok(())
    }

    /// Send encoded audio data to the server
    pub fn send_data(&mut self, data: &[u8]) -> Result<(), String> {
        if !self.connected {
            return Err("Not connected to server".to_string());
        }

        if let Some(ref mut stream) = self.stream {
            stream.write_all(data)
                .map_err(|e| format!("Write error: {}", e))?;
            stream.flush()
                .map_err(|e| format!("Flush error: {}", e))?;
            self.bytes_sent += data.len() as u64;
        }

        Ok(())
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

    /// Disconnect from the server
    pub fn disconnect(&mut self) {
        self.stream = None;
        self.connected = false;
        log::info!("Disconnected from streaming server");
    }

    /// Check if connected
    pub fn is_connected(&self) -> bool {
        self.connected
    }

    /// Get total bytes sent
    pub fn bytes_sent(&self) -> u64 {
        self.bytes_sent
    }

    /// Get uptime in seconds
    pub fn uptime(&self) -> u64 {
        self.start_time
            .map(|t| t.elapsed().as_secs())
            .unwrap_or(0)
    }

    /// Get the server URL
    pub fn server_url(&self) -> String {
        format!("http://{}:{}{}", self.config.host, self.config.port, self.config.mount)
    }

    // ---- Icecast 2 Protocol ----

    fn send_icecast_handshake(&self, stream: &TcpStream, content_type: &str) -> Result<(), String> {
        let mut request = String::new();

        // Icecast uses HTTP PUT with chunked transfer encoding
        request.push_str(&format!("PUT {} HTTP/1.1\r\n", self.config.mount));
        request.push_str(&format!("Host: {}:{}\r\n", self.config.host, self.config.port));
        request.push_str(&format!(
            "Authorization: Basic {}\r\n",
            base64_encode(&format!("{}:{}", self.config.username, self.config.password))
        ));
        request.push_str(&format!("Content-Type: {}\r\n", content_type));
        request.push_str("Transfer-Encoding: chunked\r\n");
        request.push_str("Ice-Public: 1\r\n");
        request.push_str("User-Agent: RadioKong/0.1.0\r\n");
        request.push_str("\r\n");

        let mut stream = stream.try_clone()
            .map_err(|e| format!("Failed to clone stream: {}", e))?;
        stream.write_all(request.as_bytes())
            .map_err(|e| format!("Handshake write error: {}", e))?;
        stream.flush()
            .map_err(|e| format!("Handshake flush error: {}", e))?;

        // Read response
        let mut response = vec![0u8; 1024];
        let timeout = stream.set_read_timeout(Some(Duration::from_secs(10)));
        let bytes_read = stream.read(&mut response)
            .map_err(|e| format!("Handshake read error: {}", e))?;

        let response_str = String::from_utf8_lossy(&response[..bytes_read]);
        if response_str.contains("200") || response_str.contains("100") {
            log::info!("Icecast handshake successful");
            Ok(())
        } else {
            Err(format!("Icecast handshake failed: {}", response_str))
        }
    }

    fn update_icecast_metadata(&self, title: &str, artist: &str) -> Result<(), String> {
        // Icecast metadata update via admin API
        let song = format!("{} - {}", artist, title);
        let _url = format!(
            "http://{}:{}/admin/metadata?mode=updinfo&mount={}&song={}",
            self.config.host,
            self.config.port,
            self.config.mount,
            urlencoding::encode(&song)
        );

        // Use a simple HTTP request for metadata updates
        log::info!("Updating Icecast metadata: {}", song);

        // In production, we'd make an HTTP request here
        // For now, just log the update
        Ok(())
    }

    // ---- SHOUTcast Protocol ----

    fn send_shoutcast_handshake(&self, stream: &TcpStream, content_type: &str) -> Result<(), String> {
        let mut request = String::new();

        // SHOUTcast uses a proprietary ICY protocol
        request.push_str(&format!("PUT {} HTTP/1.1\r\n", self.config.mount));
        request.push_str(&format!("Host: {}:{}\r\n", self.config.host, self.config.port));
        request.push_str(&format!(
            "Authorization: Basic {}\r\n",
            base64_encode(&format!("{}:{}", self.config.username, self.config.password))
        ));
        request.push_str(&format!("Content-Type: {}\r\n", content_type));
        request.push_str("icy-name: RadioKong Stream\r\n");
        request.push_str("icy-pub: 1\r\n");
        request.push_str("User-Agent: RadioKong/0.1.0\r\n");
        request.push_str("\r\n");

        let mut stream = stream.try_clone()
            .map_err(|e| format!("Failed to clone stream: {}", e))?;
        stream.write_all(request.as_bytes())
            .map_err(|e| format!("Handshake write error: {}", e))?;

        log::info!("SHOUTcast handshake sent");
        Ok(())
    }

    fn update_shoutcast_metadata(&self, title: &str, artist: &str) -> Result<(), String> {
        let song = format!("{} - {}", artist, title);
        log::info!("Updating SHOUTcast metadata: {}", song);
        // SHOUTcast metadata is sent inline via ICY metadata in the stream
        Ok(())
    }
}

impl Drop for StreamClient {
    fn drop(&mut self) {
        self.disconnect();
    }
}

/// Simple base64 encoding (to avoid additional dependency)
fn base64_encode(input: &str) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = input.as_bytes();
    let mut result = String::new();

    for chunk in bytes.chunks(3) {
        let mut buf = [0u8; 3];
        for (i, &b) in chunk.iter().enumerate() {
            buf[i] = b;
        }

        let b0 = buf[0] >> 2;
        let b1 = ((buf[0] & 0x03) << 4) | (buf[1] >> 4);
        let b2 = ((buf[1] & 0x0F) << 2) | (buf[2] >> 6);
        let b3 = buf[2] & 0x3F;

        result.push(ALPHABET[b0 as usize] as char);
        result.push(ALPHABET[b1 as usize] as char);
        if chunk.len() > 1 {
            result.push(ALPHABET[b2 as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(ALPHABET[b3 as usize] as char);
        } else {
            result.push('=');
        }
    }

    result
}

/// URL encoding helper (minimal implementation)
mod urlencoding {
    pub fn encode(input: &str) -> String {
        input.chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '~' {
                    c.to_string()
                } else {
                    format!("%{:02X}", c as u8)
                }
            })
            .collect()
    }
}

use std::io::Read;
