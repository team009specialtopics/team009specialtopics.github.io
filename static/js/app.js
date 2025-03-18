// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyARK3nDjmqVuDaAyixj3jkBSIIrjRb3dLM",
    authDomain: "agriculture-espnow.firebaseapp.com",
    databaseURL: "https://agriculture-espnow-default-rtdb.firebaseio.com",
    projectId: "agriculture-espnow",
    storageBucket: "agriculture-espnow.firebasestorage.app",
    messagingSenderId: "284327283088",
    appId: "1:284327283088:web:9886195d82792b92bf4b15"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Global state
let currentSensor = 'home';
let connectionRef = null;

// DOM elements
const loadingOverlay = document.getElementById('loading-overlay');
const errorModal = document.getElementById('error-modal');
const errorMessage = document.getElementById('error-message');
const connectionStatus = document.getElementById('connection-status');
const sensorList = document.getElementById('sensor-list');
const homeControl = document.getElementById('home-control');

// Initialize all gauges
const gauges = {};
['n2', 'n3', 'n4'].forEach(sensorId => {
    gauges[sensorId] = {
        temperature: createTemperatureGauge(document.getElementById(`${sensorId}-temperature-gauge`)),
        humidity: createHumidityGauge(document.getElementById(`${sensorId}-humidity-gauge`)),
        moisture: createMoistureGauge(document.getElementById(`${sensorId}-moisture-gauge`))
    };
});

// Show loading overlay
const showLoading = () => {
    loadingOverlay.classList.add('active');
};

// Hide loading overlay
const hideLoading = () => {
    loadingOverlay.classList.remove('active');
};

// Show error modal
const showError = (message) => {
    errorMessage.textContent = message;
    errorModal.classList.add('active');
    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('disconnected');
    connectionStatus.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
};

// Update gauges for a specific sensor
const updateSensorGauges = (sensorId, data) => {
    if (!data) return;

    const temperature = data.t;
    const humidity = data.h;
    const moisture = data.s;

    if (gauges[sensorId]) {
        gauges[sensorId].temperature.set(temperature);
        document.getElementById(`${sensorId}-temp`).textContent = `${temperature.toFixed(1)}°C`;

        gauges[sensorId].humidity.set(humidity);
        document.getElementById(`${sensorId}-humidity`).textContent = `${humidity}%`;

        gauges[sensorId].moisture.set(moisture);
        document.getElementById(`${sensorId}-moisture`).textContent = `${moisture}%`;
    }
};

// Update all sensors data
const updateAllSensorsData = () => {
    ['n2', 'n3', 'n4'].forEach(sensorId => {
        database.ref(`/data/${sensorId}`).once('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                updateSensorGauges(sensorId, data);
            }
        });
    });
};

// Setup toggle controls
const setupToggleControls = () => {
    // Individual sensor toggles
    const sensorToggles = document.querySelectorAll('.water-pump-toggle[data-sensor="n2"], .water-pump-toggle[data-sensor="n3"], .water-pump-toggle[data-sensor="n4"]');
    sensorToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const sensorId = e.target.getAttribute('data-sensor');
            const nodeNumber = parseInt(sensorId.substring(1));
            
            // If toggle is checked, write the node number, otherwise write 0
            const controlValue = e.target.checked ? nodeNumber : 0;
            
            // Update Firebase control value
            database.ref('control').set(controlValue)
                .then(() => {
                    console.log(`Control updated to ${controlValue}`);
                    
                    // Update status text
                    const statusElement = e.target.closest('.sensor-control').querySelector('.toggle-status');
                    statusElement.textContent = e.target.checked ? 'ON' : 'OFF';
                    
                    // Turn off global control if individual node is activated
                    if (controlValue !== 0 && controlValue !== 9) {
                        const globalToggle = document.querySelector('.water-pump-toggle[data-sensor="global"]');
                        if (globalToggle && globalToggle.checked) {
                            globalToggle.checked = false;
                            globalToggle.closest('.sensor-control').querySelector('.toggle-status').textContent = 'OFF';
                        }
                    }
                })
                .catch(error => {
                    console.error("Error updating control:", error);
                    showError(`Failed to update pump control: ${error.message}`);
                });
        });
    });
    
    // Global toggle (value 9)
    const globalToggle = document.querySelector('.water-pump-toggle[data-sensor="global"]');
    if (globalToggle) {
        globalToggle.addEventListener('change', (e) => {
            // If global toggle is checked, write 9, otherwise write 0
            const controlValue = e.target.checked ? 9 : 0;
            
            // Update Firebase control value
            database.ref('control').set(controlValue)
                .then(() => {
                    console.log(`Global control updated to ${controlValue}`);
                    
                    // Update status text
                    const statusElement = e.target.closest('.sensor-control').querySelector('.toggle-status');
                    statusElement.textContent = e.target.checked ? 'ON' : 'OFF';
                    
                    // Turn off individual toggles if global is activated
                    if (controlValue === 9) {
                        sensorToggles.forEach(toggle => {
                            if (toggle.checked) {
                                toggle.checked = false;
                                toggle.closest('.sensor-control').querySelector('.toggle-status').textContent = 'OFF';
                            }
                        });
                    }
                })
                .catch(error => {
                    console.error("Error updating global control:", error);
                    showError(`Failed to update global control: ${error.message}`);
                });
        });
    }
    
    // Listen for control changes from Firebase
    database.ref('control').on('value', (snapshot) => {
        const controlValue = snapshot.val();
        console.log(`Control value changed to: ${controlValue}`);
        
        // Update toggle states based on the control value
        if (globalToggle) {
            globalToggle.checked = (controlValue === 9);
            globalToggle.closest('.sensor-control').querySelector('.toggle-status').textContent = 
                (controlValue === 9) ? 'ON' : 'OFF';
        }
        
        sensorToggles.forEach(toggle => {
            const sensorId = toggle.getAttribute('data-sensor');
            const nodeNumber = parseInt(sensorId.substring(1));
            
            toggle.checked = (controlValue === nodeNumber);
            toggle.closest('.sensor-control').querySelector('.toggle-status').textContent = 
                (controlValue === nodeNumber) ? 'ON' : 'OFF';
        });
    });
};

// Connect to Firebase and listen for changes
const connectToSensor = (sensorId) => {
    showLoading();
    
    // Show/hide appropriate controls based on selected sensor
    if (sensorId === 'home') {
        // Show home controls, hide individual controls
        homeControl.style.display = 'block';
        document.querySelectorAll('#n2-control-card, #n3-control-card, #n4-control-card').forEach(card => {
            card.style.display = 'none';
        });
        
        updateAllSensorsData();
        hideLoading();
        connectionStatus.classList.add('connected');
        connectionStatus.classList.remove('disconnected');
        connectionStatus.innerHTML = '<i class="fas fa-circle"></i> Connected';
        return;
    } else {
        // Hide home controls, show only the relevant individual control
        homeControl.style.display = 'none';
        document.querySelectorAll('#n2-control-card, #n3-control-card, #n4-control-card').forEach(card => {
            card.style.display = 'none';
        });
        const selectedControl = document.getElementById(`${sensorId}-control-card`);
        if (selectedControl) {
            selectedControl.style.display = 'block';
        }
    }

    // Remove previous listener if exists
    if (connectionRef) {
        connectionRef.off();
    }

    connectionRef = database.ref(`/data/${sensorId}`);
    connectionRef.on('value', (snapshot) => {
        hideLoading();
        const data = snapshot.val();

        if (data) {
            updateSensorGauges(sensorId, data);
            connectionStatus.classList.add('connected');
            connectionStatus.classList.remove('disconnected');
            connectionStatus.innerHTML = '<i class="fas fa-circle"></i> Connected';
        } else {
            showError(`No data available for sensor ${sensorId}`);
        }
    }, (error) => {
        hideLoading();
        showError(`Error connecting to sensor ${sensorId}: ${error.message}`);
    });
};

// Retry connection
const retryConnection = () => {
    errorModal.classList.remove('active');
    connectToSensor(currentSensor);
};
window.retryConnection = retryConnection; // Make available globally

// Handle sensor selection
sensorList.addEventListener('click', (e) => {
    if (e.target.tagName === 'LI') {
        const sensorId = e.target.getAttribute('data-sensor');
        currentSensor = sensorId;

        // Update active state
        document.querySelectorAll('#sensor-list li').forEach(li => {
            li.classList.remove('active');
        });
        e.target.classList.add('active');

        // Toggle views based on selection
        document.querySelectorAll('.sensor-row').forEach(row => {
            row.style.display = 'none';
        });

        if (sensorId === 'home') {
            document.querySelectorAll('.sensor-row').forEach(row => {
                row.style.display = 'block';
            });
        } else {
            const selectedSensor = document.getElementById(`sensor-${sensorId}`);
            if (selectedSensor) {
                selectedSensor.style.display = 'block';
            }
        }

        connectToSensor(sensorId);
    }
});

// Initialize toggle controls
setupToggleControls();

// Initial connection
connectToSensor(currentSensor);

// Handle visibility change
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        connectToSensor(currentSensor);
    }
});
