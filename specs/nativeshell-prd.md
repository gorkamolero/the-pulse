# NativeShell — Product Requirements Document

## Overview

**Product Name:** NativeShell  
**Platform:** iOS (iPhone first, iPad later)  
**Version:** 0.1.0 (MVP)  
**Author:** Gorka Molero  
**Date:** 2026-01-27

---

## Problem Statement

Mobile terminal apps force users into a 1970s input paradigm: character-by-character entry, no word-level editing, broken dictation, and hostile keyboard experiences. This makes SSH sessions from mobile devices frustrating, especially for AI-assisted coding workflows (Claude Code, etc.).

---

## Solution

A terminal app with two input modes:
1. **Composer Mode** — Native text input with full iOS affordances (dictation, word selection, autocomplete). Commands are staged and edited naturally before sending.
2. **Terminal Mode** — Traditional direct-to-PTY input for interactive programs (vim, htop, etc.).

---

## Goals

1. Make dictating shell commands feel native
2. Support SSH connections with key-based auth
3. Integrate with Tailscale for easy device discovery
4. Provide pinch-to-zoom on terminal output
5. Ship a TestFlight beta within 3 weeks

---

## Non-Goals (v0.1)

- Mosh protocol support
- Claude Code-specific UI (detecting prompts, native approve buttons)
- Autocomplete/suggestions
- iPad optimization
- Android version

---

## Development Approach: TDD

**Every feature follows Test-Driven Development:**
1. Write failing test first
2. Implement minimum code to pass
3. Refactor
4. Verify with `xcodebuild test`

**No phase proceeds until all tests pass.**

---

## Phase 0: Project Setup (EXPLICIT)

### 0.1 Create Xcode Project with xcodegen

**Prerequisites:**
```bash
# Ensure xcodegen is installed
which xcodegen || brew install xcodegen
```

**Working directory:** `/Users/gorkolas/www/nativeshell`

**Step 1: Create project.yml**

```yaml
name: NativeShell
options:
  bundleIdPrefix: com.gorkamolero
  deploymentTarget:
    iOS: "16.0"
  xcodeVersion: "15.0"
  generateEmptyDirectories: true

settings:
  base:
    SWIFT_VERSION: "5.9"
    DEVELOPMENT_TEAM: ""  # Fill in for signing
  configs:
    Debug:
      SWIFT_ACTIVE_COMPILATION_CONDITIONS: DEBUG
    Release:
      SWIFT_OPTIMIZATION_LEVEL: -O

packages:
  SwiftTerm:
    url: https://github.com/migueldeicaza/SwiftTerm
    from: "1.0.0"

targets:
  NativeShell:
    type: application
    platform: iOS
    sources:
      - path: NativeShell
        excludes:
          - "**/*.md"
    dependencies:
      - package: SwiftTerm
    settings:
      base:
        INFOPLIST_FILE: NativeShell/Info.plist
        PRODUCT_BUNDLE_IDENTIFIER: com.gorkamolero.nativeshell
        ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon
    preBuildScripts: []
    
  NativeShellTests:
    type: bundle.unit-test
    platform: iOS
    sources:
      - NativeShellTests
    dependencies:
      - target: NativeShell
    settings:
      base:
        INFOPLIST_FILE: NativeShellTests/Info.plist
```

**Step 2: Create folder structure**

```bash
cd /Users/gorkolas/www/nativeshell

mkdir -p NativeShell/{App,Views,Models,Services,Utilities}
mkdir -p NativeShell/Resources
mkdir -p NativeShellTests
```

**Step 3: Create Info.plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>0.1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    <key>UIApplicationSceneManifest</key>
    <dict>
        <key>UIApplicationSupportsMultipleScenes</key>
        <false/>
    </dict>
    <key>UILaunchScreen</key>
    <dict/>
    <key>UIRequiredDeviceCapabilities</key>
    <array>
        <string>armv7</string>
    </array>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
    </array>
</dict>
</plist>
```

**Step 4: Create minimal app files**

`NativeShell/App/NativeShellApp.swift`:
```swift
import SwiftUI

@main
struct NativeShellApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

`NativeShell/Views/ContentView.swift`:
```swift
import SwiftUI

struct ContentView: View {
    var body: some View {
        Text("NativeShell")
            .font(.largeTitle)
    }
}

#Preview {
    ContentView()
}
```

**Step 5: Generate and verify**

```bash
cd /Users/gorkolas/www/nativeshell
xcodegen generate
xcodebuild -project NativeShell.xcodeproj -scheme NativeShell -sdk iphonesimulator -configuration Debug build
```

### 0.2 Verification Gate

**Tests that must pass before Phase 1:**
```bash
# Project exists
test -f NativeShell.xcodeproj/project.pbxproj && echo "PASS: xcodeproj exists"

# Build succeeds
xcodebuild -project NativeShell.xcodeproj -scheme NativeShell -sdk iphonesimulator build 2>&1 | grep -q "BUILD SUCCEEDED" && echo "PASS: Build succeeded"
```

---

## Phase 1: Terminal View (TDD)

### 1.1 Write Tests First

`NativeShellTests/TerminalViewTests.swift`:
```swift
import XCTest
@testable import NativeShell

final class TerminalViewTests: XCTestCase {
    
    func testTerminalViewExists() {
        // TerminalView type should exist
        let _ = TerminalContainerView()
        XCTAssertTrue(true)
    }
    
    func testTerminalViewHasScrollback() {
        // Terminal should support scrollback
        let config = TerminalConfig()
        XCTAssertGreaterThanOrEqual(config.scrollbackLines, 10000)
    }
    
    func testTerminalViewSupportsZoom() {
        // Zoom range should be 0.5x to 3x
        let config = TerminalConfig()
        XCTAssertEqual(config.minZoom, 0.5)
        XCTAssertEqual(config.maxZoom, 3.0)
    }
}
```

### 1.2 Run Tests (Should Fail)

```bash
xcodebuild test -project NativeShell.xcodeproj -scheme NativeShell -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15'
```

### 1.3 Implement to Pass

Create `NativeShell/Models/TerminalConfig.swift`:
```swift
import Foundation

struct TerminalConfig {
    var scrollbackLines: Int = 10000
    var minZoom: Double = 0.5
    var maxZoom: Double = 3.0
    var defaultFontSize: CGFloat = 14
    var fontName: String = "SF Mono"
}
```

Create `NativeShell/Views/TerminalContainerView.swift`:
```swift
import SwiftUI
import SwiftTerm

struct TerminalContainerView: UIViewRepresentable {
    @State private var scale: CGFloat = 1.0
    let config: TerminalConfig
    
    init(config: TerminalConfig = TerminalConfig()) {
        self.config = config
    }
    
    func makeUIView(context: Context) -> TerminalView {
        let terminal = TerminalView(frame: .zero)
        // Configure terminal with SwiftTerm
        return terminal
    }
    
    func updateUIView(_ uiView: TerminalView, context: Context) {
        // Update on state changes
    }
}
```

### 1.4 Verification Gate

```bash
xcodebuild test -project NativeShell.xcodeproj -scheme NativeShell -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15' 2>&1 | grep -q "Test Suite.*passed" && echo "PASS: Phase 1 tests passed"
```

---

## Phase 2: SSH Connection (TDD)

### 2.1 Write Tests First

`NativeShellTests/SSHServiceTests.swift`:
```swift
import XCTest
@testable import NativeShell

final class SSHServiceTests: XCTestCase {
    
    func testSSHServiceCanBeCreated() {
        let service = SSHService()
        XCTAssertNotNil(service)
    }
    
    func testAuthMethodTypes() {
        // Should support password and key auth
        let password = AuthMethod.password("secret")
        let key = AuthMethod.privateKey(path: "/path/to/key", passphrase: nil)
        
        XCTAssertNotNil(password)
        XCTAssertNotNil(key)
    }
    
    func testConnectionStateTracking() {
        let service = SSHService()
        XCTAssertEqual(service.state, .disconnected)
    }
}
```

### 2.2 Implement to Pass

Create `NativeShell/Services/SSHService.swift`:
```swift
import Foundation

enum AuthMethod {
    case password(String)
    case privateKey(path: String, passphrase: String?)
}

enum ConnectionState {
    case disconnected
    case connecting
    case connected
    case error(String)
}

@MainActor
class SSHService: ObservableObject {
    @Published var state: ConnectionState = .disconnected
    
    func connect(host: String, port: Int, username: String, auth: AuthMethod) async throws {
        state = .connecting
        // TODO: Implement with SSH library
    }
    
    func disconnect() {
        state = .disconnected
    }
    
    func send(_ data: Data) {
        // TODO: Send to SSH channel
    }
}
```

### 2.3 Verification Gate

```bash
xcodebuild test ... | grep "SSHServiceTests.*passed"
```

---

## Phase 3: Input System (TDD)

### 3.1 Write Tests First

`NativeShellTests/InputSystemTests.swift`:
```swift
import XCTest
@testable import NativeShell

final class InputSystemTests: XCTestCase {
    
    func testInputModeToggle() {
        var mode = InputMode.composer
        mode = .terminal
        XCTAssertEqual(mode, .terminal)
    }
    
    func testComposerCanStageText() {
        let composer = ComposerState()
        composer.text = "ls -la"
        XCTAssertEqual(composer.text, "ls -la")
    }
    
    func testSpecialKeysExist() {
        let keys = SpecialKey.allCases
        XCTAssertTrue(keys.contains(.tab))
        XCTAssertTrue(keys.contains(.escape))
        XCTAssertTrue(keys.contains(.ctrl))
        XCTAssertTrue(keys.contains(.arrowUp))
    }
}
```

### 3.2 Implement to Pass

Create `NativeShell/Models/InputMode.swift`:
```swift
enum InputMode: Equatable {
    case composer
    case terminal
}
```

Create `NativeShell/Models/ComposerState.swift`:
```swift
import Foundation

@Observable
class ComposerState {
    var text: String = ""
    
    func send() -> String {
        let command = text
        text = ""
        return command
    }
}
```

Create `NativeShell/Models/SpecialKey.swift`:
```swift
enum SpecialKey: CaseIterable {
    case tab
    case escape
    case ctrl
    case arrowUp
    
    var bytes: [UInt8] {
        switch self {
        case .tab: return [0x09]
        case .escape: return [0x1B]
        case .ctrl: return [] // Modifier
        case .arrowUp: return [0x1B, 0x5B, 0x41]
        }
    }
}
```

---

## Phase 4: Connection Manager (TDD)

### 4.1 Write Tests First

`NativeShellTests/HostStoreTests.swift`:
```swift
import XCTest
@testable import NativeShell

final class HostStoreTests: XCTestCase {
    
    func testCanCreateHost() {
        let host = SavedHost(
            name: "Dev Server",
            hostname: "192.168.1.100",
            port: 22,
            username: "admin"
        )
        XCTAssertEqual(host.name, "Dev Server")
    }
    
    func testHostStoreCanSaveAndLoad() {
        let store = HostStore()
        let host = SavedHost(name: "Test", hostname: "test.local", port: 22, username: "user")
        
        store.add(host)
        XCTAssertEqual(store.hosts.count, 1)
        
        store.remove(host)
        XCTAssertEqual(store.hosts.count, 0)
    }
    
    func testHostIsCodable() {
        let host = SavedHost(name: "Test", hostname: "test.local", port: 22, username: "user")
        let data = try? JSONEncoder().encode(host)
        XCTAssertNotNil(data)
        
        let decoded = try? JSONDecoder().decode(SavedHost.self, from: data!)
        XCTAssertEqual(decoded?.name, "Test")
    }
}
```

### 4.2 Implement to Pass

Create `NativeShell/Models/SavedHost.swift`:
```swift
import Foundation

struct SavedHost: Codable, Identifiable, Equatable {
    let id: UUID
    var name: String
    var hostname: String
    var port: Int
    var username: String
    
    init(id: UUID = UUID(), name: String, hostname: String, port: Int = 22, username: String) {
        self.id = id
        self.name = name
        self.hostname = hostname
        self.port = port
        self.username = username
    }
}
```

Create `NativeShell/Services/HostStore.swift`:
```swift
import Foundation

@Observable
class HostStore {
    private(set) var hosts: [SavedHost] = []
    
    func add(_ host: SavedHost) {
        hosts.append(host)
        save()
    }
    
    func remove(_ host: SavedHost) {
        hosts.removeAll { $0.id == host.id }
        save()
    }
    
    private func save() {
        // TODO: Persist to JSON file
    }
    
    private func load() {
        // TODO: Load from JSON file
    }
}
```

---

## Verification Commands Reference

```bash
# Full test suite
xcodebuild test \
  -project NativeShell.xcodeproj \
  -scheme NativeShell \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 15'

# Build only
xcodebuild build \
  -project NativeShell.xcodeproj \
  -scheme NativeShell \
  -sdk iphonesimulator

# Specific test class
xcodebuild test \
  -project NativeShell.xcodeproj \
  -scheme NativeShell \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  -only-testing:NativeShellTests/TerminalViewTests
```

---

## Features (Reference)

### F1: Connection Manager
**Priority:** P0 (Must Have)

- Add/edit/delete saved hosts
- Fields: Name, Hostname/IP, Port (default 22), Username, Auth Method
- Auth methods: Password, Private Key (stored in Keychain), SSH Agent
- List view with quick-connect

### F2: Terminal View
**Priority:** P0 (Must Have)

- Full terminal emulation via SwiftTerm
- Renders ANSI colors and cursor positioning
- Pinch-to-zoom gesture (0.5x to 3x scale)
- Scrollback buffer (minimum 10,000 lines)

### F3: Composer Mode Input
**Priority:** P0 (Must Have)

- Native UITextView above terminal
- Multiline support (expands as needed)
- Full iOS keyboard with dictation
- Send button (or Return key) submits to terminal
- Clears after send

### F4: Terminal Mode Input
**Priority:** P0 (Must Have)

- Toggle switch: [Composer] ↔ [Terminal]
- In Terminal Mode, keyboard goes directly to PTY
- For use with vim, nano, htop, etc.

### F5: Special Key Buttons
**Priority:** P1 (Should Have)

- Toolbar above keyboard with: [↑ History] [Tab] [Ctrl] [Esc]
- Ctrl: Tap, then next key sent with Ctrl modifier
- Esc: Sends escape immediately
- Tab: Sends tab character
- History: Shows recent commands picker

### F6: Tailscale Integration
**Priority:** P1 (Should Have)

- Detect if Tailscale is installed/active
- When adding host, offer picker of Tailscale devices
- Show friendly names from `tailscale status`

### F7: Command History
**Priority:** P2 (Nice to Have)

- Per-host command history
- Persisted locally
- Accessible via [↑] button in composer
- Can select and edit before re-sending

---

## Technical Requirements

### T1: Dependencies

| Component | Library | URL |
|-----------|---------|-----|
| Terminal Emulation | SwiftTerm | https://github.com/migueldeicaza/SwiftTerm |
| SSH Protocol | SwiftSH or NMSSH | https://github.com/Lakr233/SwiftSH |
| UI Framework | SwiftUI + UIKit | Native |
| Secure Storage | iOS Keychain | Native |

### T2: Minimum iOS Version
- iOS 16.0+

---

## Success Criteria

Each phase is complete when:
1. All tests for that phase pass
2. `xcodebuild test` exits with code 0
3. No compiler warnings in new code

---

*Document Version: 2.0 — TDD Edition*
