const axios = require("axios");
require("dotenv").config();

async function Whatsappapi(req, res) {
  const apiUrl = "https://backend.api-wa.co/campaign/smartping/api/v2";
  const apiKey = process.env.API_KEY; // Ensure your API key is set in the .env file
  const { url, destination } = req.body;

  console.log("apikey", apiKey);
  // Prepare the request payload
  const requestData = {
    apiKey: apiKey,
    campaignName: "vms_image", // Campaign name, ensure this is correct
    destination: destination, // Dynamic phone number
    userName: "ganesh@brihaspathi.com", // Example username, ensure this is dynamic if necessary
    templateParams: ["This", "just", "totest", "API", "Fms"], // Dynamic message content
    source: "new-landing-page form",
    media: {
      url: url,
      // url: "https://whatsapp-media-library.s3.ap-south-1.amazonaws.com/IMAGE/6353da2e153a147b991dd812/4958901_highanglekidcheatingschooltestmin.jpg",
      filename: "sample_media",
    },
    tags: "", // Can be set if required, leave empty if not
  };

  try {
    // Send the POST request to the Smartping API
    const response = await axios.post(apiUrl, requestData, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Return response from the API to the frontend
    return res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Error sending message:",
      error.response ? error.response.data : error.message
    );

    // Handle errors in the API call
    return res.status(500).json({
      success: false,
      message: "Error sending message",
      error: error.response ? error.response.data : error.message,
    });
  }
}

module.exports = Whatsappapi;
