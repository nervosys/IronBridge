//! A typed **ontology** of the Apple / Xcode build domain.
//!
//! This is the vocabulary the rest of the automation speaks: the entities Apple
//! reasons about (platforms, SDKs, architectures, destinations, product types,
//! signing identities, provisioning profiles, simulators) and the relationships
//! between them (a [`Platform`] names an SDK family and constrains the valid
//! [`Arch`]s; a [`Destination`] binds a platform to a concrete device/OS; a
//! [`SigningIdentity`] plus a [`ProvisioningProfile`] authorize a build).
//!
//! Everything here is pure data + parsing/formatting — no process execution — so
//! it compiles and is testable on any host, including the Windows machines that
//! cannot run Xcode itself.

use std::fmt;

/// An Apple platform (the thing `xcodebuild -sdk` and destinations name).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Platform {
    /// Physical iOS devices.
    IOS,
    /// The iOS simulator.
    IOSSimulator,
    /// macOS.
    MacOS,
    /// Mac Catalyst (iOS apps on macOS).
    MacCatalyst,
    /// watchOS devices.
    WatchOS,
    /// The watchOS simulator.
    WatchOSSimulator,
    /// tvOS devices.
    TvOS,
    /// The tvOS simulator.
    TvOSSimulator,
    /// visionOS devices.
    VisionOS,
    /// The visionOS simulator.
    VisionOSSimulator,
}

impl Platform {
    /// Every modeled platform.
    pub const ALL: [Platform; 10] = [
        Platform::IOS,
        Platform::IOSSimulator,
        Platform::MacOS,
        Platform::MacCatalyst,
        Platform::WatchOS,
        Platform::WatchOSSimulator,
        Platform::TvOS,
        Platform::TvOSSimulator,
        Platform::VisionOS,
        Platform::VisionOSSimulator,
    ];

    /// The SDK family name Apple uses (`xcodebuild -sdk <name>`,
    /// `xcrun --sdk <name>`): e.g. `iphoneos`, `iphonesimulator`.
    pub fn sdk_family(self) -> &'static str {
        match self {
            Platform::IOS => "iphoneos",
            Platform::IOSSimulator => "iphonesimulator",
            Platform::MacOS | Platform::MacCatalyst => "macosx",
            Platform::WatchOS => "watchos",
            Platform::WatchOSSimulator => "watchsimulator",
            Platform::TvOS => "appletvos",
            Platform::TvOSSimulator => "appletvsimulator",
            Platform::VisionOS => "xros",
            Platform::VisionOSSimulator => "xrsimulator",
        }
    }

    /// The name used in a `-destination platform=<name>` clause.
    pub fn destination_name(self) -> &'static str {
        match self {
            Platform::IOS => "iOS",
            Platform::IOSSimulator => "iOS Simulator",
            Platform::MacOS => "macOS",
            Platform::MacCatalyst => "macOS,variant=Mac Catalyst",
            Platform::WatchOS => "watchOS",
            Platform::WatchOSSimulator => "watchOS Simulator",
            Platform::TvOS => "tvOS",
            Platform::TvOSSimulator => "tvOS Simulator",
            Platform::VisionOS => "visionOS",
            Platform::VisionOSSimulator => "visionOS Simulator",
        }
    }

    /// True for the simulator platforms.
    pub fn is_simulator(self) -> bool {
        matches!(
            self,
            Platform::IOSSimulator
                | Platform::WatchOSSimulator
                | Platform::TvOSSimulator
                | Platform::VisionOSSimulator
        )
    }

    /// The architectures Apple ships for this platform today. This is the
    /// ontology's platform→arch relationship, used to reject impossible
    /// destinations (e.g. `x86_64` on a watchOS device).
    pub fn architectures(self) -> &'static [Arch] {
        match self {
            Platform::IOS | Platform::TvOS => &[Arch::Arm64],
            Platform::WatchOS => &[Arch::Arm64_32, Arch::Arm64],
            Platform::VisionOS => &[Arch::Arm64],
            // Simulators and macOS run on both Apple silicon and Intel.
            Platform::IOSSimulator
            | Platform::WatchOSSimulator
            | Platform::TvOSSimulator
            | Platform::VisionOSSimulator
            | Platform::MacOS
            | Platform::MacCatalyst => &[Arch::Arm64, Arch::X86_64],
        }
    }

    /// Whether `arch` is valid for this platform.
    pub fn supports(self, arch: Arch) -> bool {
        self.architectures().contains(&arch)
    }

    /// Parse the SDK family name back to a platform (simulator families map to
    /// the simulator variant).
    pub fn from_sdk_family(s: &str) -> Option<Platform> {
        Some(match s.trim().to_ascii_lowercase().as_str() {
            "iphoneos" => Platform::IOS,
            "iphonesimulator" => Platform::IOSSimulator,
            "macosx" => Platform::MacOS,
            "watchos" => Platform::WatchOS,
            "watchsimulator" => Platform::WatchOSSimulator,
            "appletvos" => Platform::TvOS,
            "appletvsimulator" => Platform::TvOSSimulator,
            "xros" => Platform::VisionOS,
            "xrsimulator" => Platform::VisionOSSimulator,
            _ => return None,
        })
    }
}

impl fmt::Display for Platform {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.destination_name())
    }
}

/// A CPU architecture in Apple's naming.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Arch {
    /// 64-bit ARM (all modern devices, Apple-silicon simulators/macs).
    Arm64,
    /// 64-bit ARM with pointer authentication (some Apple silicon slices).
    Arm64e,
    /// 32-bit-pointer ARM64 used by Apple Watch.
    Arm64_32,
    /// x86-64 (Intel Macs and their simulators).
    X86_64,
}

impl Arch {
    /// The clang/Apple spelling.
    pub fn as_str(self) -> &'static str {
        match self {
            Arch::Arm64 => "arm64",
            Arch::Arm64e => "arm64e",
            Arch::Arm64_32 => "arm64_32",
            Arch::X86_64 => "x86_64",
        }
    }

    /// Parse an arch spelling.
    pub fn parse(s: &str) -> Option<Arch> {
        Some(match s.trim() {
            "arm64" | "aarch64" => Arch::Arm64,
            "arm64e" => Arch::Arm64e,
            "arm64_32" => Arch::Arm64_32,
            "x86_64" | "amd64" => Arch::X86_64,
            _ => return None,
        })
    }
}

impl fmt::Display for Arch {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// A dotted version like `17.4` or `17.4.1`, ordered numerically.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Version {
    /// The numeric components, most-significant first.
    pub parts: Vec<u32>,
}

impl Version {
    /// Parse `"17.4.1"`; rejects empty/non-numeric components.
    pub fn parse(s: &str) -> Option<Version> {
        let parts: Option<Vec<u32>> = s.trim().split('.').map(|p| p.parse::<u32>().ok()).collect();
        let parts = parts?;
        if parts.is_empty() {
            None
        } else {
            Some(Version { parts })
        }
    }
}

impl fmt::Display for Version {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s: Vec<String> = self.parts.iter().map(|p| p.to_string()).collect();
        f.write_str(&s.join("."))
    }
}

impl PartialOrd for Version {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Version {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // Compare component-wise, treating a missing trailing component as 0.
        let n = self.parts.len().max(other.parts.len());
        for i in 0..n {
            let a = self.parts.get(i).copied().unwrap_or(0);
            let b = other.parts.get(i).copied().unwrap_or(0);
            match a.cmp(&b) {
                std::cmp::Ordering::Equal => continue,
                ord => return ord,
            }
        }
        std::cmp::Ordering::Equal
    }
}

/// An installed SDK: a platform at a version, on disk.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstalledSdk {
    /// The platform this SDK targets.
    pub platform: Platform,
    /// The SDK version.
    pub version: Version,
    /// The canonical name, e.g. `iphoneos17.4`.
    pub canonical_name: String,
    /// Absolute path to the SDK, if known.
    pub path: Option<String>,
}

/// A build destination — the ontology's binding of platform + a concrete
/// device/simulator + OS version, i.e. what `xcodebuild -destination` selects.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Destination {
    /// The platform.
    pub platform: Platform,
    /// Device name (`iPhone 15`) or `None` for "any device".
    pub device_name: Option<String>,
    /// A specific device/simulator UDID, if targeting one exactly.
    pub udid: Option<String>,
    /// OS version constraint, if any.
    pub os: Option<Version>,
}

impl Destination {
    /// A "generic" destination for a platform (`generic/platform=iOS`), used for
    /// device archives where no specific device is attached.
    pub fn generic(platform: Platform) -> Destination {
        Destination {
            platform,
            device_name: None,
            udid: None,
            os: None,
        }
    }

    /// A named simulator destination.
    pub fn simulator(platform: Platform, device_name: impl Into<String>, os: Option<Version>) -> Destination {
        Destination {
            platform,
            device_name: Some(device_name.into()),
            udid: None,
            os,
        }
    }

    /// Render the `-destination` argument value xcodebuild expects.
    pub fn to_arg(&self) -> String {
        // A UDID uniquely identifies a booted simulator/device.
        if let Some(udid) = &self.udid {
            return format!("id={udid}");
        }
        // With no device name and no udid, this is the generic platform form.
        if self.device_name.is_none() && self.os.is_none() {
            return format!("generic/platform={}", self.platform.destination_name());
        }
        let mut s = format!("platform={}", self.platform.destination_name());
        if let Some(name) = &self.device_name {
            s.push_str(&format!(",name={name}"));
        }
        if let Some(os) = &self.os {
            s.push_str(&format!(",OS={os}"));
        }
        s
    }
}

/// A build configuration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BuildConfiguration {
    /// The `Debug` configuration.
    Debug,
    /// The `Release` configuration.
    Release,
    /// A project-defined configuration.
    Custom(String),
}

impl BuildConfiguration {
    /// The configuration name as xcodebuild expects it.
    pub fn name(&self) -> &str {
        match self {
            BuildConfiguration::Debug => "Debug",
            BuildConfiguration::Release => "Release",
            BuildConfiguration::Custom(s) => s,
        }
    }
}

/// The kind of product a target builds.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProductType {
    /// An `.app` application bundle.
    Application,
    /// A dynamic `.framework`.
    Framework,
    /// A static library.
    StaticLibrary,
    /// An app extension (`.appex`).
    AppExtension,
    /// An `.xctest` bundle.
    UnitTest,
    /// A multi-platform `.xcframework`.
    XcFramework,
}

impl ProductType {
    /// The on-disk bundle/file extension (without the dot), if it is a bundle.
    pub fn bundle_extension(self) -> Option<&'static str> {
        Some(match self {
            ProductType::Application => "app",
            ProductType::Framework => "framework",
            ProductType::AppExtension => "appex",
            ProductType::UnitTest => "xctest",
            ProductType::XcFramework => "xcframework",
            ProductType::StaticLibrary => return None,
        })
    }
}

/// The class of an Apple code-signing identity.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SigningKind {
    /// `Apple Development` — run on registered devices during development.
    Development,
    /// `Apple Distribution` — App Store / ad-hoc distribution.
    Distribution,
    /// `Developer ID Application` — Mac distribution outside the App Store.
    DeveloperId,
    /// An ad-hoc (`-`) signature — no certificate.
    AdHoc,
}

/// A code-signing identity from the keychain.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SigningIdentity {
    /// Its class.
    pub kind: SigningKind,
    /// The common name (`Apple Development: Jane Doe (TEAMID)`).
    pub name: String,
    /// The SHA-1 fingerprint `security` prints, if known.
    pub sha1: Option<String>,
}

impl SigningIdentity {
    /// Classify an identity by the prefix of its common name.
    pub fn classify(name: &str) -> SigningKind {
        let n = name.trim();
        if n == "-" {
            SigningKind::AdHoc
        } else if n.starts_with("Apple Distribution") || n.starts_with("iPhone Distribution") {
            SigningKind::Distribution
        } else if n.starts_with("Developer ID Application") {
            SigningKind::DeveloperId
        } else {
            // Apple Development / iPhone Developer / everything else dev-shaped.
            SigningKind::Development
        }
    }
}

/// A provisioning profile — the ontology's authorization artifact binding a team,
/// an app id, devices, and entitlements to a platform.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProvisioningProfile {
    /// The profile's display name.
    pub name: String,
    /// Its UUID.
    pub uuid: String,
    /// The Apple team identifier.
    pub team_id: String,
    /// The platform it applies to.
    pub platform: Platform,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn platform_arch_relationship_rejects_impossible_pairs() {
        assert!(Platform::IOS.supports(Arch::Arm64));
        assert!(!Platform::IOS.supports(Arch::X86_64));
        assert!(Platform::IOSSimulator.supports(Arch::X86_64));
        assert!(Platform::WatchOS.supports(Arch::Arm64_32));
    }

    #[test]
    fn sdk_family_round_trips() {
        for p in Platform::ALL {
            // macOS and Mac Catalyst share the macosx family, so only assert the
            // canonical direction for the rest.
            if p == Platform::MacCatalyst {
                continue;
            }
            assert_eq!(Platform::from_sdk_family(p.sdk_family()), Some(p), "{p:?}");
        }
    }

    #[test]
    fn versions_order_numerically_not_lexically() {
        let a = Version::parse("17.4").unwrap();
        let b = Version::parse("17.10").unwrap();
        assert!(a < b, "17.4 < 17.10");
        assert!(Version::parse("17.4.1").unwrap() > Version::parse("17.4").unwrap());
        assert!(Version::parse("18").unwrap() > Version::parse("17.9.9").unwrap());
    }

    #[test]
    fn destination_renders_generic_named_and_udid_forms() {
        assert_eq!(
            Destination::generic(Platform::IOS).to_arg(),
            "generic/platform=iOS"
        );
        assert_eq!(
            Destination::simulator(Platform::IOSSimulator, "iPhone 15", Version::parse("17.4")).to_arg(),
            "platform=iOS Simulator,name=iPhone 15,OS=17.4"
        );
        let mut d = Destination::generic(Platform::IOSSimulator);
        d.udid = Some("ABC-123".into());
        assert_eq!(d.to_arg(), "id=ABC-123");
    }

    #[test]
    fn signing_identities_are_classified_by_name() {
        assert_eq!(SigningIdentity::classify("-"), SigningKind::AdHoc);
        assert_eq!(
            SigningIdentity::classify("Apple Distribution: Acme (TEAM)"),
            SigningKind::Distribution
        );
        assert_eq!(
            SigningIdentity::classify("Apple Development: Jane (TEAM)"),
            SigningKind::Development
        );
        assert_eq!(
            SigningIdentity::classify("Developer ID Application: Acme (TEAM)"),
            SigningKind::DeveloperId
        );
    }
}
