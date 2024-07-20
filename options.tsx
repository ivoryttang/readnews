import { useState } from "react"

function Options() {
  const [apiKey, setApiKey] = useState("")

  const handleApiKeyChange = (event) => {
    setApiKey(event.target.value)
  }

  const saveOptions = () => {
    // Save the API key to local storage or some persistent storage
    // This is a placeholder for actual implementation
    console.log("API Key saved:", apiKey)
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Let's Talk News - Options</h1>
      <div>
        <label htmlFor="api-key">Cartesia API Key:</label>
        <input
          id="api-key"
          type="text"
          value={apiKey}
          onChange={handleApiKeyChange}
          placeholder="Enter your Cartesia API Key here"
        />
      </div>
      <button onClick={saveOptions}>Save</button>
    </div>
  )
}

export default Options
