# 24/7 Google Colab Hosting using Hugging Face Virtual Desktop

Because Hugging Face does not allow heavy YouTube downloading or `ffmpeg` usage directly on their servers, we use Google Colab to host the backend. However, Colab disconnects if your laptop is turned off. 

To fix this, we can use a free **Virtual Desktop** hosted on Hugging Face to keep Colab alive forever!

## Step 1: Create the Virtual Desktop on Hugging Face
1. Go to Hugging Face and search for "Ubuntu Desktop" or go directly to: [yuvraj-k/Ubuntu-Desktop](https://huggingface.co/spaces/yuvraj-k/Ubuntu-Desktop)
2. Click the 3 dots in the top right and select **"Duplicate Space"**.
3. You now have a private, 24/7 running computer inside Hugging Face.

## Step 2: Set up Colab Inside the Virtual Desktop
1. Open your new Virtual Desktop on Hugging Face.
2. Open the Google Chrome browser inside the virtual desktop.
3. Log into your Google Account.
4. Open your `Colab-Server.ipynb` notebook.

## Step 3: Run the 60-Minute "Restart & Run All" Bot
We don't want to just keep the server alive; we want to completely **restart the server every 60 minutes**. This ensures YouTube cookies are forcefully wiped and fetched fresh every single hour, guaranteeing downloads never fail.

1. Inside the Hugging Face virtual browser, press **`F12`** on the Colab tab to open the Developer Console.
2. Copy the entire contents of the `colab_restart_bot.js` file from this repository.
3. Paste the code into the Console and press **Enter**.

You can now completely close the Hugging Face tab and turn off your laptop. The Hugging Face Virtual Desktop will stay online 24/7, and every 60 minutes, the bot will automatically click "Restart and run all" to boot a fresh Colab server!


