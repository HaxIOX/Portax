# Portax

[English](./README.md) | [中文](./README_CN.md)

A modern, feature-rich web-based serial port debugging tool with an elegant UI and powerful functionality.

![Portax Demo](assets/image-20260113223119750.png)

## ✨ Features

- **Beautiful UI** - Clean interface with dark/light theme support
- **Keyword Highlighting** - Customizable keyword highlighting with color configuration
- **⚡ Quick Commands** - Save and manage frequently used commands with persistent storage
- **Command History** - Navigate through send history using `↑` / `↓` keys
- **Data Filtering** - Real-time log search and filtering
- **RX/TX Monitoring** - Dynamic RX/TX indicators with breathing light effects
- **Waveform Plotting** - Visualize serial data with real-time charts (beta)
- **Snapshot & Export** - Capture waveform snapshots and export to PDF reports

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- Modern browser with Web Serial API support (Chrome 89+, Edge 89+)

### Installation

```bash
# Clone the repository
git clone https://github.com/HaxIOX/Portax.git
cd portax

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

## 📸 Screenshots

**Main Interface**
![Interface](assets/image-20260113223119750.png)

**Command Management**
![Commands](assets/image-20260113223127271.png)

**Waveform Monitor**
![Waveform](assets/image-20260113223132043.png)

**Data Export**
![Export](assets/image-20260113223136669.png)

## 🛠️ Technology Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Core API**: Web Serial API

## ⚠️ Important Notes

1. **HTTPS Required** - Web Serial API only works on `localhost` or `https://` due to security requirements
2. **USB Drivers** - USB-to-serial chip drivers (e.g., CH340, CP2102) must be installed on your OS
3. **Browser Permissions** - Device access requires user authorization via browser dialog

## 🗺️ Roadmap

- [ ] Optimize waveform chart performance
- [ ] Windows desktop client
- [ ] Support for additional protocols (Modbus, CANbus, etc.)
- [ ] Multi-language support
- [ ] Plugin system

## 📄 License

GNU GPL v3.0

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Visit the [Issues page](https://github.com/HaxIOX/Portax/issues).

---

Made with ❤️ using React and Web Serial API
