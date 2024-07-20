## Let's Talk News 

Let's Talk News is a simple Chrome extension that reads articles online for you using TTS.

It can:

→ Read entire article out loud using [Cartesia](https://cartesia.ai/)'s text-to-speech api (**Cmd+Shift+S**) 

→ Jump to certain passages (**Cmd+Shift+E**)

→ Change voices

## Configuration

Before running the extension, you need to get an API key from [Cartesia](https://cartesia.ai/) and set it in your .env file.


## Getting Started

This is a [Plasmo extension](https://docs.plasmo.com/) project.

First, run the development server:

```bash
pnpm dev
# or
npm run dev
```

Open your browser and load the appropriate development build. For example, if you are developing for the chrome browser, using manifest v3, use: `build/chrome-mv3-dev`.

## Making production build

Run the following:

```bash
pnpm build
# or
npm run build
```

This should create a production bundle for your extension, ready to be zipped and published to the stores.

