let audioPlayer = null; // A single reusable audio player instance
let currentButton = null; // Track the active play/stop button
let lastDataHash = ""; // Store the hash of the last data received to detect changes
let currentIndex = 0; // Track the currently selected stream index

// Fetch RSAS data and update the UI
async function fetchRSASData() {
    try {
        const response = await fetch("https://radio.xogium.me:8443/health");
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();
        //console.log("Fetched Data:", data); // Debugging: Log the data

        // Hash the current data to detect changes
        const dataHash = hashData(data);

        if (dataHash !== lastDataHash) {
            // Only update the UI if the data has changed
            lastDataHash = dataHash;
            updateGlobalStats(data);
            updateMounts(data.mounts);
        }
    } catch (error) {
        console.error("Failed to fetch RSAS data:", error);
    } finally {
        // Poll the server again after processing
        setTimeout(fetchRSASData, 1000); // Poll every second
    }
}

// Simple hash function to compare previous and current data
function hashData(data) {
    return JSON.stringify(data); // Return a stringified version of the data
}

// Initialize the single audio player for reuse
function initializeAudioPlayer() {
    audioPlayer = document.createElement("audio");
    audioPlayer.id = "audioplayer";
    audioPlayer.style.display = "none";
    audioPlayer.addEventListener("ended", resetPlayback); // Reset when playback ends
    document.body.appendChild(audioPlayer);
}

// Update the global stats (total listeners and total sources)
function updateGlobalStats(data) {
    const totalListeners = data.total_listener_count || 0;
    const totalSources = data.total_source_count || 0;

    document.getElementById("total-listeners").textContent = totalListeners;
    document.getElementById("total-sources").textContent = totalSources;
}

// Update the mounts and streams based on the fetched data
function updateMounts(mounts) {
    const container = document.getElementById("mounts-container");
    container.innerHTML = ""; // Clear existing mounts

    if (!mounts || Object.keys(mounts).length === 0) {
        container.innerHTML = `<p>No active mounts available.</p>`;
        return;
    }

    // Generate list of streams with navigation support
    Object.entries(mounts).forEach(([mount, details], index) => {
        const mountDiv = document.createElement("div");
        mountDiv.classList.add("mount");
        if (index === currentIndex) {
            mountDiv.classList.add("active"); // Highlight the current stream
        }

        const streamUrl = `https://radio.xogium.me${mount}`;
        const nowPlaying = details.metadata?.now_playing || "N/A";

        // Create play/stop button
        const button = document.createElement("button");
        if (audioPlayer && audioPlayer.src === streamUrl && !audioPlayer.paused) {
            button.textContent = "⏹️ Stop"; // Changed to the stop emoji
            currentButton = button; // Keep reference to the active button
        } else {
            button.textContent = "▶ Play";
        }
        button.onclick = () => togglePlayback(mount, button);

        mountDiv.innerHTML = `
            <h3>Mount: ${mount}</h3>
            <p>Status: ${details.status || "Unknown"}</p>
            <p>Listeners: ${details.listener_count || 0}</p>
            <p>Now Playing: ${nowPlaying}</p>
        `;
        mountDiv.appendChild(button);
        container.appendChild(mountDiv);

        // Attach the URL as a data attribute for easier access later
        mountDiv.dataset.url = streamUrl;
    });
}

// Toggle between playing and stopping the stream
function togglePlayback(mount, button) {
    const streamUrl = `https://radio.xogium.me${mount}`;

    if (audioPlayer && audioPlayer.src === streamUrl && !audioPlayer.paused) {
        // Stop the current stream
        stopPlayback();
        button.textContent = "▶ Play"; // Reset button text
    } else {
        // Play the selected stream
        stopPlayback(); // Stop any currently playing stream
        startPlayback(streamUrl, button);
    }
}

// Start playing the selected stream
function startPlayback(src, button) {
    if (!src) {
        console.error("No valid stream URL provided.");
        return;
    }

    if (audioPlayer.src !== src) {
        audioPlayer.src = src;
    }
    audioPlayer.play().catch((err) => console.error("Playback error:", err)); // Catch errors if autoplay is blocked
    button.textContent = "⏹️ Stop"; // Update button to indicate it's playing
    currentButton = button;
}

// Stop the current stream and reset button state
function stopPlayback() {
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.src = ""; // Clear the source to disconnect
    }

    // Reset the previous button, if any
    if (currentButton) {
        currentButton.textContent = "▶ Play";
        currentButton = null;
    }
}

// Reset playback when audio ends (if needed)
function resetPlayback() {
    if (currentButton) {
        currentButton.textContent = "▶ Play";
        currentButton = null;
    }
}

// Handle keyboard navigation for streams
function handleKeyNavigation(event) {
    const mounts = document.querySelectorAll(".mount");
    if (mounts.length === 0) return;

    switch (event.key) {
        case "ArrowUp":
            // Move selection up
            currentIndex = (currentIndex > 0) ? currentIndex - 1 : mounts.length - 1;
            break;
        case "ArrowDown":
            // Move selection down
            currentIndex = (currentIndex < mounts.length - 1) ? currentIndex + 1 : 0;
            break;
        case "ArrowRight":
            // Play the currently selected stream
            const playUrl = mounts[currentIndex].dataset.url;
            startPlayback(playUrl, mounts[currentIndex].querySelector('button')); // Pass the button along
            break;
        case "ArrowLeft":
            // Stop playback
            stopPlayback();
            break;
    }

    // Update the active highlight
    mounts.forEach((mount, index) => {
        mount.classList.toggle("active", index === currentIndex);
    });
}

// Initial setup on page load
window.onload = () => {
    initializeAudioPlayer(); // Initialize the audio player
    fetchRSASData(); // Start fetching RSAS data
    window.addEventListener("keydown", handleKeyNavigation); // Attach keyboard navigation
};

