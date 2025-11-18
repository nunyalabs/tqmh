document.addEventListener('DOMContentLoaded', () => {
    // --- AUTHENTICATION & USER INFO ---
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // Page sections
    const dashboardPage = document.getElementById('dashboardPage');
    const registrationPage = document.getElementById('registrationPage');
    const consultationPage = document.getElementById('consultationPage');
    const settingsPage = document.getElementById('settingsPage');

    // Nav buttons
    const navDashboard = document.getElementById('navDashboard');
    const navRegister = document.getElementById('navRegister');
    const navSettings = document.getElementById('navSettings');
    const logoutButton = document.getElementById('logoutButton');

    // Forms and tables
    const registrationForm = document.getElementById('registrationForm');
    const patientsTableBody = document.getElementById('patientsTableBody');
    const exportCsvButton = document.getElementById('exportCsv');
    const patientCountSpan = document.getElementById('patientCount');

    // Settings Page Elements
    const facilityForm = document.getElementById('facilityForm');
    const userForm = document.getElementById('userForm');
    const usersTableBody = document.getElementById('usersTableBody');
    const exportJsonButton = document.getElementById('exportJson');
    const importJsonInput = document.getElementById('importJson');
    const searchInput = document.getElementById('searchInput');

    // --- GLOBAL FUNCTIONS (within DOMContentLoaded) ---
    window.viewVisits = viewVisits;
    window.updatePatientDetails = updatePatientDetails;
    window.deleteUserById = deleteUserById;
    let deferredPrompt;

    // To track if the registration form is in 'update' mode
    let patientToUpdateId = null;

    // --- COMMON HELPERS ---
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('registrationDate').setAttribute('max', today);
    document.getElementById('dob').setAttribute('max', today);

    // Auto-calculate age
    const dobInput = document.getElementById('dob');
    const ageInput = document.getElementById('age');
    dobInput.addEventListener('change', () => {
        if (dobInput.value) {
            const birthDate = new Date(dobInput.value);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            ageInput.value = age;
        }
    });

    // --- NAVIGATION ---
    function showPage(pageToShow, navToActivate) {
        [dashboardPage, registrationPage, consultationPage, settingsPage].forEach(page => {
            page.classList.add('hidden');
        });
        pageToShow.classList.remove('hidden');

        [navDashboard, navRegister, navSettings].forEach(btn => btn.classList.remove('active'));
        if (navToActivate) {
            navToActivate.classList.add('active');
        }
    }

    navDashboard.addEventListener('click', () => showPage(dashboardPage, navDashboard));
    navRegister.addEventListener('click', () => {
        registrationForm.reset();
        patientToUpdateId = null; // Ensure we are in 'add' mode
        document.getElementById('registrationFormSubmitButton').textContent = 'Register Patient';
        showPage(registrationPage, navRegister);
    });
    navSettings.addEventListener('click', () => {
        loadUsers();
        loadFacilityName();
        showPage(settingsPage, navSettings);
    });

    logoutButton.addEventListener('click', () => {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    });


    // --- PATIENT REGISTRATION ---
    const kinRelationSelect = document.getElementById('kinRelation');
    const kinRelationOtherWrapper = document.getElementById('kinRelationOtherWrapper');
    kinRelationSelect.addEventListener('change', () => {
        kinRelationOtherWrapper.classList.toggle('hidden', kinRelationSelect.value !== 'Other');
    });

    const insuranceTypeSelect = document.getElementById('insuranceType');
    const nhisFields = document.getElementById('nhisFields');
    const privateInsuranceFields = document.getElementById('privateInsuranceFields');
    insuranceTypeSelect.addEventListener('change', () => {
        nhisFields.classList.toggle('hidden', insuranceTypeSelect.value !== 'NHIS');
        privateInsuranceFields.classList.toggle('hidden', insuranceTypeSelect.value !== 'Private');
    });

    registrationForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const patientData = {
            registrationNumber: document.getElementById('registrationNumber').value,
            registrationDate: document.getElementById('registrationDate').value,
            fullName: document.getElementById('fullName').value,
            dob: document.getElementById('dob').value,
            age: document.getElementById('age').value,
            sex: document.getElementById('sex').value,
            maritalStatus: document.getElementById('maritalStatus').value,
            occupation: document.getElementById('occupation').value,
            religion: document.getElementById('religion').value,
            homeAddress: document.getElementById('homeAddress').value,
            telephone: document.getElementById('telephone').value,
            kinName: document.getElementById('kinName').value,
            kinRelation: document.getElementById('kinRelation').value,
            kinRelationOther: document.getElementById('kinRelationOther').value,
            kinContact: document.getElementById('kinContact').value,
            insuranceType: document.getElementById('insuranceType').value,
            nhisNumber: document.getElementById('nhisNumber').value,
            cccCode: document.getElementById('cccCode').value,
            privateProvider: document.getElementById('privateProvider').value,
            insuranceNumber: document.getElementById('insuranceNumber').value,
            remarks: document.getElementById('remarks').value,
        };

        if (patientToUpdateId) {
            // This is an update
            patientData.id = patientToUpdateId;
            // TODO: In the future, save this to a 'pending_updates' store for admin approval.
            // For now, we update directly.
            updatePatient(patientData).then(() => {
                alert('Patient details updated successfully!');
                registrationForm.reset();
                patientToUpdateId = null;
                loadPatients();
                showPage(dashboardPage, navDashboard);
            }).catch(err => console.error('Update failed', err));
        } else {
            // This is a new registration
            addPatient(patientData).then(() => {
                alert('Patient registered successfully!');
                registrationForm.reset();
                loadPatients();
                showPage(dashboardPage, navDashboard);
            }).catch(error => console.error(error));
        }
    });

    // --- PATIENT LIST (DASHBOARD) ---
    let allPatients = []; // Cache all patients for searching

    function loadPatients() {
        getAllPatients().then(patients => {
            allPatients = patients;
            patientCountSpan.textContent = patients.length;
            renderPatientTable(patients);
        });
    }

    exportCsvButton.addEventListener('click', () => {
        getAllPatients().then(patients => {
            if (patients.length === 0) {
                alert('No patients to export.');
                return;
            }
            const headers = Object.keys(patients[0]);
            const csvContent = [
                headers.join(','),
                ...patients.map(patient => headers.map(header => `"${patient[header]}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', 'patients.csv');
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        });
    });
    
    function renderPatientTable(patients) {
        patientsTableBody.innerHTML = '';
        if (patients.length === 0) {
            patientsTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No patients found.</td></tr>';
            return;
        }
        patients.forEach(patient => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${patient.registrationNumber}</td>
                <td>${patient.fullName}</td>
                <td>${patient.age || 'N/A'}</td>
                <td>${patient.sex}</td>
                <td>${patient.telephone}</td>
                <td>${patient.insuranceType}</td>
                <td>
                    <div class="flex gap-2">
                        <button class="btn btn-sm btn-primary action-record-visit hidden" onclick="viewVisits(${patient.id})">Record Visit</button>
                        <button class="btn btn-sm btn-secondary action-update-details hidden" onclick="updatePatientDetails(${patient.id})">Update Details</button>
                    </div>
                </td>
            `;
            patientsTableBody.appendChild(row);
        });
        applyPermissions(); // Re-apply permissions to the newly created buttons
    }

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredPatients = allPatients.filter(p => 
            p.fullName.toLowerCase().includes(searchTerm) || p.registrationNumber.toLowerCase().includes(searchTerm)
        );
        renderPatientTable(filteredPatients);
    });

    // --- PWA Install Prompt ---
    const installAppButton = document.getElementById('installAppButton');

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;
        // Update UI to notify the user they can install the PWA
        installAppButton.classList.remove('hidden');
    });

    installAppButton.addEventListener('click', async () => {
        // Hide the app provided install promotion
        installAppButton.classList.add('hidden');
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        await deferredPrompt.userChoice;
        // We've used the prompt, and can't use it again, throw it away
        deferredPrompt = null;
    });

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }

    // --- CLINICAL CONSULTATION ---
    const closeConsultationButton = document.getElementById('closeConsultation');
    const consultationForm = document.getElementById('consultationForm');
    const consultationPatientIdInput = document.getElementById('consultationPatientId');

    closeConsultationButton.addEventListener('click', () => {
        showPage(dashboardPage, navDashboard);
    });

    consultationForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const visitData = {
            patientId: parseInt(consultationPatientIdInput.value, 10),
            visitDate: new Date().toISOString(),
            history: document.getElementById('history').value,
            examinationFindings: document.getElementById('examinationFindings').value,
            investigations: document.getElementById('investigations').value,
            diagnosis: document.getElementById('diagnosis').value,
            principalDiagnosis: document.getElementById('principalDiagnosis').value,
            additionalDiagnosis: document.getElementById('additionalDiagnosis').value,
            treatment: document.getElementById('treatment').value,
            clinicalRemarks: document.getElementById('clinicalRemarks').value,
        };

        addVisit(visitData).then(() => {
            alert('Consultation saved successfully!');
            consultationForm.reset();
            showPage(dashboardPage, navDashboard);
        }).catch(error => {
            console.error('Error saving visit:', error);
            alert('Error saving consultation.');
        });
    });

    // --- SETTINGS PAGE ---
    facilityForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const facilityName = document.getElementById('facilityName').value;
        await saveSetting('facilityName', facilityName.trim());
        alert('Facility metadata saved.');
        // Update the header immediately
        updateFacilityHeader();
    });

    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newUser = {
            username: document.getElementById('newUsername').value,
            password: document.getElementById('newPassword').value,
            role: document.getElementById('userRole').value,
        };
        try {
            await addUser(newUser);
            alert('User created successfully.');
            userForm.reset();
            loadUsers();
        } catch (error) {
            alert('Error creating user. Username may already exist.');
            console.error(error);
        }
    });

    async function loadUsers() {
        const users = await getAllUsers();
        usersTableBody.innerHTML = '';
        users.forEach(user => {
            const row = document.createElement('tr');
            const isCurrentUser = user.id === currentUser.id;
            row.innerHTML = `
                <td>${user.username} ${isCurrentUser ? '(You)' : ''}</td>
                <td>${user.role}</td>
                <td>
                    <button class="btn btn-sm btn-secondary action-delete-user hidden" onclick="deleteUserById(${user.id})" ${isCurrentUser ? 'disabled' : ''}>Delete</button>
                </td>`;
            usersTableBody.appendChild(row);
        });
        applyPermissions();
    }

    async function loadFacilityName() {
        const facilityName = await getSetting('facilityName');
        if (facilityName) {
            document.getElementById('facilityName').value = facilityName;
        }
    }

    async function updateFacilityHeader() {
        const facilityName = await getSetting('facilityName');
        const headerTitle = document.getElementById('headerFacilityName');
        if (headerTitle) {
            headerTitle.textContent = facilityName || 'Clinical MS';
        }
    }

    exportJsonButton.addEventListener('click', async () => {
        if (!confirm('This will export all data including users. Continue?')) return;
        try {
            const allData = await exportAllData();
            const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
        } catch (error) {
            console.error('Export failed:', error);
            alert('Data export failed.');
        }
    });

    importJsonInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm('WARNING: This will overwrite all existing data. Are you sure you want to proceed?')) {
            importJsonInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                await importAllData(data);
                alert('Data imported successfully. The application will now reload.');
                location.reload();
            } catch (error) {
                console.error('Import failed:', error);
                alert('Data import failed. Please check the file format.');
            }
        };
        reader.readAsText(file);
    });

    // --- ROLE-BASED ACCESS CONTROL ---
    function applyPermissions() {
        const role = currentUser.role;

        if (role === 'admin') {
            navRegister.classList.remove('hidden');
            navSettings.classList.remove('hidden');
            exportCsvButton.classList.remove('hidden');
            document.querySelectorAll('.action-record-visit, .action-update-details')
                .forEach(el => el.classList.remove('hidden'));
        } else if (role === 'records') {
            navRegister.classList.remove('hidden');
            exportCsvButton.classList.remove('hidden');
            document.querySelectorAll('.action-update-details').forEach(el => el.classList.remove('hidden'));
        } else if (role === 'clinician') {
            document.querySelectorAll('.action-record-visit').forEach(el => el.classList.remove('hidden'));
        }

        if (role === 'admin') {
            document.querySelectorAll('.action-record-visit').forEach(el => el.classList.remove('hidden'));
        }
    }

    // --- INITIAL LOAD ---
    loadPatients();
    updateFacilityHeader();
    showPage(dashboardPage, navDashboard);
    // applyPermissions is called within loadPatients -> renderPatientTable

    // --- Global Function Definitions ---
    async function viewVisits(patientId) {
        // Clear form from previous data
        consultationForm.reset();
        document.getElementById('consultationPatientId').value = patientId;

        // Pre-fill with last visit data
        try {
            const visits = await getVisitsForPatient(patientId);
            if (visits.length > 0) {
                // Sort by date descending to get the latest visit
                visits.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
                const lastVisit = visits[0];
                for (const key in lastVisit) {
                    const field = document.getElementById(key);
                    if (field) field.value = lastVisit[key];
                }
            }
        } catch (error) {
            console.error('Could not pre-fill last visit data:', error);
        }

        // Use the same navigation logic as button clicks
        showPage(consultationPage, null); // Show page without activating a nav button
    }

    async function updatePatientDetails(patientId) {
        try {
            const patient = await getPatientById(patientId);
            if (!patient) {
                alert('Patient not found!');
                return;
            }

            // Populate the form
            for (const key in patient) {
                const field = document.getElementById(key);
                if (field) field.value = patient[key];
            }

            patientToUpdateId = patientId;
            document.getElementById('registrationFormSubmitButton').textContent = 'Save Updates';
            showPage(registrationPage, navRegister);
        } catch (error) {
            console.error('Failed to load patient details for update:', error);
        }
    }

    async function deleteUserById(userId) {
        if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            try {
                await deleteUser(userId);
                alert('User deleted successfully.');
                loadUsers(); // Refresh the user list
            } catch (error) {
                alert(`Failed to delete user: ${error}`);
            }
        }
    }
});
