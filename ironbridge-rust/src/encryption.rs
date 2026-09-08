// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! Encryption at Rest for Session Data
//!
//! This module provides AES-256-GCM encryption for sensitive session data,
//! including messages, tool invocations, and metadata.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;

// =============================================================================
// Encryption Configuration
// =============================================================================

const NONCE_SIZE: usize = 12;
const KEY_SIZE: usize = 32;

/// Encrypted data wrapper with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedData {
    /// Base64-encoded encrypted ciphertext
    pub ciphertext: String,
    /// Base64-encoded nonce (initialization vector)
    pub nonce: String,
    /// Encryption algorithm identifier
    pub algorithm: String,
    /// Key derivation parameters
    pub kdf: KeyDerivation,
    /// Version for future compatibility
    pub version: u8,
}

/// Key derivation function parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyDerivation {
    /// KDF algorithm (pbkdf2, argon2id)
    pub algorithm: String,
    /// Base64-encoded salt
    pub salt: String,
    /// Iteration count (for PBKDF2)
    pub iterations: Option<u32>,
    /// Memory cost (for Argon2)
    pub memory: Option<u32>,
    /// Time cost (for Argon2)
    pub time: Option<u32>,
}

// =============================================================================
// Encryption Manager
// =============================================================================

/// Session encryption manager
pub struct EncryptionManager {
    /// Derived encryption key
    key: Key<Aes256Gcm>,
    /// Whether encryption is enabled
    enabled: bool,
}

/// PBKDF2 iteration count for data written from now on -- OWASP's current
/// floor for PBKDF2-HMAC-SHA256.
pub const KDF_ITERATIONS_CURRENT: u32 = 600_000;

/// The count everything before the per-record migration was written under.
/// A stored record with no recorded count is assumed to be one of these.
pub const KDF_ITERATIONS_LEGACY: u32 = 100_000;

impl EncryptionManager {
    /// Create a new encryption manager with a password, at the legacy count.
    ///
    /// Kept for existing callers and tests. New code that stores the iteration
    /// count should use [`EncryptionManager::new_with_iterations`] so the count
    /// it derived under travels with the ciphertext.
    pub fn new(password: &str, salt: &[u8]) -> Result<Self> {
        Self::new_with_iterations(password, salt, KDF_ITERATIONS_LEGACY)
    }

    /// Create a manager whose key is derived at an explicit iteration count.
    ///
    /// The count is not part of the key or the ciphertext, so whoever decrypts
    /// must derive at the same count. That is exactly why the credential store
    /// records it per row: a credential written at 600k and one written at 100k
    /// both decrypt, each with the count it was written under.
    pub fn new_with_iterations(password: &str, salt: &[u8], iterations: u32) -> Result<Self> {
        let key = Self::derive_key(password, salt, iterations)?;
        Ok(Self { key, enabled: true })
    }

    /// Create a disabled encryption manager (passthrough)
    pub fn disabled() -> Self {
        Self {
            key: Key::<Aes256Gcm>::default(),
            enabled: false,
        }
    }

    /// Check if encryption is enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Derive an AES-256 key from a password with PBKDF2-HMAC-SHA256.
    ///
    /// The iteration count is a parameter, not a constant, precisely because it
    /// changed: raising it re-derives a different key, so the count that wrote a
    /// ciphertext is the only count that can read it. The credential store keeps
    /// the count per row for that reason; see `handlers_simple::read_credential`.
    fn derive_key(password: &str, salt: &[u8], iterations: u32) -> Result<Key<Aes256Gcm>> {
        let mut key = [0u8; KEY_SIZE];

        pbkdf2::pbkdf2_hmac::<sha2::Sha256>(password.as_bytes(), salt, iterations, &mut key);

        Ok(*Key::<Aes256Gcm>::from_slice(&key))
    }

    /// Encrypt data
    pub fn encrypt(&self, plaintext: &[u8]) -> Result<EncryptedData> {
        if !self.enabled {
            return Err(anyhow!("Encryption is not enabled"));
        }

        let cipher = Aes256Gcm::new(&self.key);

        // Generate random nonce
        let nonce_bytes: [u8; NONCE_SIZE] = rand::random();
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Encrypt
        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| anyhow!("Encryption failed: {}", e))?;

        Ok(EncryptedData {
            ciphertext: BASE64.encode(&ciphertext),
            nonce: BASE64.encode(nonce_bytes),
            algorithm: "AES-256-GCM".to_string(),
            kdf: KeyDerivation {
                algorithm: "PBKDF2-HMAC-SHA256".to_string(),
                salt: String::new(), // Salt stored separately
                iterations: Some(100_000),
                memory: None,
                time: None,
            },
            version: 1,
        })
    }

    /// Decrypt data
    pub fn decrypt(&self, encrypted: &EncryptedData) -> Result<Vec<u8>> {
        if !self.enabled {
            return Err(anyhow!("Encryption is not enabled"));
        }

        if encrypted.version != 1 {
            return Err(anyhow!(
                "Unsupported encryption version: {}",
                encrypted.version
            ));
        }

        let cipher = Aes256Gcm::new(&self.key);

        // Decode base64
        let ciphertext = BASE64
            .decode(&encrypted.ciphertext)
            .map_err(|e| anyhow!("Invalid ciphertext encoding: {}", e))?;
        let nonce_bytes = BASE64
            .decode(&encrypted.nonce)
            .map_err(|e| anyhow!("Invalid nonce encoding: {}", e))?;

        if nonce_bytes.len() != NONCE_SIZE {
            return Err(anyhow!("Invalid nonce size"));
        }

        let nonce = Nonce::from_slice(&nonce_bytes);

        // Decrypt
        let plaintext = cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| anyhow!("Decryption failed: {}", e))?;

        Ok(plaintext)
    }

    /// Encrypt a string
    pub fn encrypt_string(&self, plaintext: &str) -> Result<String> {
        let encrypted = self.encrypt(plaintext.as_bytes())?;
        Ok(serde_json::to_string(&encrypted)?)
    }

    /// Decrypt a string
    pub fn decrypt_string(&self, encrypted_json: &str) -> Result<String> {
        let encrypted: EncryptedData = serde_json::from_str(encrypted_json)?;
        let plaintext = self.decrypt(&encrypted)?;
        String::from_utf8(plaintext).map_err(|e| anyhow!("Invalid UTF-8: {}", e))
    }
}

// =============================================================================
// Session Encryption Helpers
// =============================================================================

/// Encrypt a session's messages
pub fn encrypt_messages(manager: &EncryptionManager, messages_json: &str) -> Result<String> {
    if !manager.is_enabled() {
        return Ok(messages_json.to_string());
    }
    manager.encrypt_string(messages_json)
}

/// Decrypt a session's messages
pub fn decrypt_messages(manager: &EncryptionManager, encrypted_messages: &str) -> Result<String> {
    if !manager.is_enabled() {
        return Ok(encrypted_messages.to_string());
    }

    // Try to parse as encrypted data; if it fails, assume plaintext
    if encrypted_messages.starts_with('{') && encrypted_messages.contains("\"ciphertext\"") {
        manager.decrypt_string(encrypted_messages)
    } else {
        Ok(encrypted_messages.to_string())
    }
}

// =============================================================================
// Key Storage
// =============================================================================

/// Encryption key configuration stored in config file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionConfig {
    /// Whether encryption is enabled
    pub enabled: bool,
    /// Base64-encoded salt for key derivation
    pub salt: String,
    /// Hash of password for verification (NOT the password itself)
    pub password_hash: String,
}

impl EncryptionConfig {
    /// Create new encryption configuration
    pub fn new(password: &str) -> Self {
        let salt: [u8; 32] = rand::random();
        let password_hash = Self::hash_password(password, &salt);

        Self {
            enabled: true,
            salt: BASE64.encode(salt),
            password_hash,
        }
    }

    /// Create disabled configuration
    pub fn disabled() -> Self {
        Self {
            enabled: false,
            salt: String::new(),
            password_hash: String::new(),
        }
    }

    /// Hash password for verification
    fn hash_password(password: &str, salt: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        hasher.update(salt);
        hasher.update(b"verification");
        BASE64.encode(hasher.finalize())
    }

    /// Verify password matches
    pub fn verify_password(&self, password: &str) -> bool {
        if !self.enabled {
            return true;
        }

        if let Ok(salt) = BASE64.decode(&self.salt) {
            let hash = Self::hash_password(password, &salt);
            hash == self.password_hash
        } else {
            false
        }
    }

    /// Get the salt bytes
    pub fn get_salt(&self) -> Result<Vec<u8>> {
        BASE64
            .decode(&self.salt)
            .map_err(|e| anyhow!("Invalid salt: {}", e))
    }

    /// Load configuration from file
    pub fn load(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)?;
        Ok(serde_json::from_str(&content)?)
    }

    /// Save configuration to file
    pub fn save(&self, path: &Path) -> Result<()> {
        let content = serde_json::to_string_pretty(self)?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, content)?;
        Ok(())
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let password = "test_password_123";
        let salt = b"test_salt_12345678901234";

        let manager = EncryptionManager::new(password, salt).unwrap();

        let plaintext = "Hello, encrypted world!";
        let encrypted = manager.encrypt(plaintext.as_bytes()).unwrap();

        assert!(!encrypted.ciphertext.is_empty());
        assert!(!encrypted.nonce.is_empty());
        assert_eq!(encrypted.algorithm, "AES-256-GCM");

        let decrypted = manager.decrypt(&encrypted).unwrap();
        assert_eq!(String::from_utf8(decrypted).unwrap(), plaintext);
    }

    #[test]
    fn test_encrypt_decrypt_string() {
        let password = "secure_password";
        let salt = b"random_salt_value_here";

        let manager = EncryptionManager::new(password, salt).unwrap();

        let original = r#"{"role": "user", "content": "Secret message"}"#;
        let encrypted = manager.encrypt_string(original).unwrap();
        let decrypted = manager.decrypt_string(&encrypted).unwrap();

        assert_eq!(decrypted, original);
    }

    #[test]
    fn test_password_verification() {
        let config = EncryptionConfig::new("my_password");

        assert!(config.verify_password("my_password"));
        assert!(!config.verify_password("wrong_password"));
    }

    #[test]
    fn test_disabled_encryption() {
        let manager = EncryptionManager::disabled();
        assert!(!manager.is_enabled());

        let config = EncryptionConfig::disabled();
        assert!(!config.enabled);
        assert!(config.verify_password("any_password"));
    }
}
