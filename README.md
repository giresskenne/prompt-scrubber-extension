
 # Prompt-Scrubber

![Prompt-Scrubber Logo](icons/logo.png)

A browser extension that automatically detects and protects sensitive information in text fields across the web, with special focus on AI chat interfaces like ChatGPT.

## Features

- 🔒 **Automatic Detection**: Instantly highlights text areas containing sensitive information
- 🎯 **One-Click Scrubbing**: Easily mask sensitive data with a single click
- 🚫 **Privacy First**: 100% client-side processing, no external services
- 🎨 **Visual Feedback**: Real-time highlighting of sensitive content
- 🔄 **Toggle Protection**: Enable/disable the extension via popup

## Protected Information Types

- 🔑 API Keys (AWS, Stripe, etc.)
- 💳 Credit Card Numbers
- 📧 Email Addresses
- 🔢 Social Security Numbers (US/Canada)
- 🏛️ Bank Account Information
- 🔐 Authentication Tokens & JWTs
- 📱 Phone Numbers
- 🌐 IP Addresses
- And more...

## Installation

### Chrome/Edge
1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the extension
4. Open Chrome/Edge and navigate to `chrome://extensions`
5. Enable "Developer mode"
6. Click "Load unpacked" and select the `prompt-scrubber-extension` folder

### Firefox
1. Follow steps 1-3 above
2. Run `web-ext build`
3. Load the generated .zip file as a temporary add-on in Firefox

## Development

### Project Structure
```
prompt-scrubber-extension/
├── src/
│   ├── contentScript.js  # Main content script with UI logic
│   ├── redactor.js       # Core detection & masking logic
│   ├── bg.js            # Service worker background script
│   └── patterns.json    # Regex patterns for sensitive data
├── popup/               # Extension popup interface
└── icons/              # Extension icons and assets
```

### Build Process
```bash
# Install dependencies
npm install

# Generate redactor rules and build extension
npm run build

# Optional: Build Firefox package
web-ext build
```

## Privacy & Security

- All detection and masking happens locally in your browser
- No data is ever sent to external servers
- Uses regular expressions for pattern matching
- Supports complex data patterns while maintaining performance

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)


