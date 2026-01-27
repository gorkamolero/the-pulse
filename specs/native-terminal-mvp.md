# NativeShell MVP Spec
> Mobile terminal with native input — dictation-first UX

## Vision
A terminal app where composing commands feels native to iOS, not like fighting a 1970s teletype. Dictate, edit naturally, send when ready.

---

## MVP Scope (v0.1)

### What's In
- SSH connections (port 22, key auth + password)
- Native input composer (UITextView above terminal)
- SwiftTerm-based terminal display
- Pinch-to-zoom on terminal output
- Connection manager (save hosts)
- Tailscale-aware (detect Tailscale IPs, friendly names)

### What's Out (v0.2+)
- Mosh protocol
- Claude Code-specific UI affordances  
- Terminal state → native UI mirroring
- Autocomplete/suggestions
- Snippets/macros

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      SwiftUI App                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Terminal View (SwiftTerm)              │   │
│  │  - Renders PTY output                           │   │
│  │  - Pinch-to-zoom gesture                        │   │
│  │  - Tap to focus (but not for typing)            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Input Composer (Native)                │   │
│  │  ┌─────────────────────────────────┬──────────┐ │   │
│  │  │  UITextView (multiline)         │  Send ⏎  │ │   │
│  │  │  - Dictation works naturally    │          │ │   │
│  │  │  - Word selection/deletion      │          │ │   │
│  │  │  - Paste works properly         │          │ │   │
│  │  └─────────────────────────────────┴──────────┘ │   │
│  │  [↑ History] [Tab ⇥] [Ctrl ⌃] [Esc ⎋]          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Connection Layer                       │
├─────────────────────────────────────────────────────────┤
│  SSHConnection (NMSSH or SwiftSH)                       │
│  - Manages PTY session                                  │
│  - Sends composed input as bytes                        │
│  - Receives output → SwiftTerm                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Remote Host (SSH)                      │
└─────────────────────────────────────────────────────────┘
```

---

## User Flows

### Flow 1: Connect to Host
1. Open app → Connection list
2. Tap "+" to add new host OR select saved host
3. For new: Enter hostname/IP, port, username, auth method
4. If Tailscale detected: Show friendly device names from `tailscale status`
5. Connect → Terminal view opens

### Flow 2: Compose & Send Command
1. Terminal showing, cursor blinking
2. Tap input composer (native text field)
3. Type or dictate: "cd projects/myapp"
4. Edit naturally — select "myapp", replace with "otherapp"
5. Tap Send (or ⏎ on keyboard)
6. Text sent to terminal as if typed
7. Composer clears, ready for next command

### Flow 3: History Recall
1. In composer, tap [↑] button
2. Shows last N commands in a picker/popover
3. Select one → populates composer (editable before sending)

### Flow 4: Special Keys
1. Running vim/nano/htop — need Ctrl+C, Escape, Tab
2. Tap [Ctrl ⌃] → next key sent with Ctrl modifier
3. Tap [Esc ⎋] → sends escape immediately
4. Tap [Tab ⇥] → sends tab (autocomplete in shell)

---

## Tech Stack

| Component | Choice | Notes |
|-----------|--------|-------|
| UI Framework | SwiftUI | Modern, works well with UIKit interop |
| Terminal Emulator | [SwiftTerm](https://github.com/migueldeicaza/SwiftTerm) | Battle-tested, by Miguel de Icaza |
| SSH Library | [NMSSH](https://github.com/NMSSH/NMSSH) or [SwiftSH](https://github.com/Lakr233/SwiftSH) | NMSSH more mature, SwiftSH more modern |
| Keychain | iOS Keychain Services | Store SSH keys/passwords |
| Tailscale | Shell out to `tailscale status` or use Tailscale framework | Detect devices |

---

## Data Model

```swift
struct SavedHost: Codable, Identifiable {
    let id: UUID
    var name: String           // Display name
    var hostname: String       // IP or hostname
    var port: Int              // Default 22
    var username: String
    var authMethod: AuthMethod // .password, .key, .agent
    var tailscaleDevice: String? // If detected via Tailscale
}

enum AuthMethod: Codable {
    case password
    case key(privateKeyPath: String)
    case agent
}

struct CommandHistory: Codable {
    var hostId: UUID
    var commands: [String]     // Last N commands per host
}
```

---

## MVP Milestones

### Week 1: Foundation
- [ ] Project setup, SwiftUI skeleton
- [ ] Integrate SwiftTerm, render basic terminal view
- [ ] Integrate SSH library, establish connection
- [ ] Hardcoded test connection works

### Week 2: Input & Connections
- [ ] Native input composer UI
- [ ] Send composed text to PTY
- [ ] Special key buttons (Ctrl, Esc, Tab)
- [ ] Connection manager (add/save/delete hosts)
- [ ] Keychain integration for credentials

### Week 3: Polish & Ship
- [ ] Pinch-to-zoom on terminal
- [ ] Command history (per-host)
- [ ] Tailscale device detection
- [ ] App icon, launch screen
- [ ] TestFlight beta

---

## Open Questions

1. **Keyboard strategy:** When composer is focused, use native keyboard. When terminal needs raw input (vim, etc.), switch to terminal-mode keyboard? Or always use composer + special key buttons?

2. **Split screen:** iPad support from day 1? Or phone-only MVP?

3. **Name:** NativeShell? Compose? Speakterm? ShellPad?

---

## Success Metrics

- Can dictate a command and edit it naturally before sending
- Connects to Tailscale hosts reliably
- Claude Code (via SSH) is usable — can approve prompts, read output
- At least 1 person other than Gorka finds it useful

---

## Future (v0.2+)

- Mosh support (better on flaky connections)
- Claude Code detection: Recognize its TUI, surface native [Approve] [Reject] buttons
- Autocomplete from shell history
- Snippet library (saved command templates)
- Full native terminal state mirroring (the big vision)

---

*Last updated: 2026-01-27*
