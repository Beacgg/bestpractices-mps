// Estado global de la aplicación
const AppState = {
    currentSection: 'introduccion',
    progress: {},
    userInfo: {
        department: '',
        email: ''
    },
    quizScores: {}
};

// Gestor de estado y persistencia
const StateManager = {
    init() {
        // Cargar datos guardados
        const savedProgress = localStorage.getItem('userProgress');
        const savedDepartment = localStorage.getItem('selectedDepartment');
        const savedEmail = localStorage.getItem('userEmail');

        if (savedProgress) AppState.progress = JSON.parse(savedProgress);
        if (savedDepartment) AppState.userInfo.department = savedDepartment;
        if (savedEmail) AppState.userInfo.email = savedEmail;

        // Mostrar departamento en la UI
        document.getElementById('userDepartment').textContent = AppState.userInfo.department;
    },

    saveProgress() {
        localStorage.setItem('userProgress', JSON.stringify(AppState.progress));
    },

    markSectionComplete(sectionId) {
        AppState.progress[sectionId] = {
            completed: true,
            timestamp: new Date().toISOString()
        };
        this.saveProgress();
        this.updateProgressBar();
    },

    updateProgressBar() {
        const completedSections = Object.keys(AppState.progress).length;
        const totalSections = document.querySelectorAll('.nav-item').length;
        const progress = (completedSections / totalSections) * 100;
        document.getElementById('progressBar').style.width = `${progress}%`;
    }
};

// Gestor de navegación
const NavigationManager = {
    init() {
        this.setupNavigationHandlers();
        this.showInitialSection();
    },

    setupNavigationHandlers() {
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const sectionId = item.getAttribute('data-section');
                this.navigateToSection(sectionId);
            });
        });
    },

    navigateToSection(sectionId) {
        // Actualizar navegación
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.toggle('active', nav.getAttribute('data-section') === sectionId);
        });

        // Ocultar todas las secciones
        document.querySelectorAll('section').forEach(section => {
            section.style.display = 'none';
        });

        // Mostrar sección seleccionada
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
            AppState.currentSection = sectionId;
            window.scrollTo(0, 0);
            this.updateBreadcrumbs(sectionId);
            
            // Si es la primera vez que se visita la sección
            if (!AppState.progress[sectionId]) {
                StateManager.markSectionComplete(sectionId);
            }
        }
    },

    updateBreadcrumbs(sectionId) {
        const sectionTitle = document.querySelector(`[data-section="${sectionId}"]`).textContent;
        document.getElementById('breadcrumbs').innerHTML = `
            <span>Inicio</span>
            <span class="breadcrumb-separator">/</span>
            <span>${sectionTitle}</span>
        `;
    },

    showInitialSection() {
        // Siempre comenzar en introducción al cargar la página
        this.navigateToSection('introduccion');
    }
};


// Prevenir pérdida de progreso
window.onbeforeunload = function() {
    AppState.progress.lastSection = AppState.currentSection;
    StateManager.saveProgress();
};
// Función para enviar resultados a Google Sheets
async function sendQuizResultsToGoogleSheets(quizData) {
    try {
        const googleScriptURL = 'https://script.google.com/macros/s/AKfycbyd3o3_kKcq2V_3RpVZiXPQs5m5fO3WWTzTF7l9W7V7-w3peNXK_4VNGoRJRsqd4KG72Q/exec'; // URL del script
        console.log('URL del script:', googleScriptURL); 
        console.log('Enviando datos a Google Sheets:', quizData);

        const response = await fetch(googleScriptURL, {
            method: 'POST',
            mode: 'no-cors', // Añadir modo no-cors para evitar errores de CORS
            headers: {
                'Content-Type': 'text/plain' // Cambiar a text/plain para evitar preflight
            },
            body: JSON.stringify(quizData)
        });

        console.log('Solicitud enviada en modo no-cors');
        
        // Con mode: 'no-cors' no podemos leer la respuesta, así que asumimos éxito
        return true;
    } catch (error) {
        console.error('Error al enviar datos:', error);
        return false;
    }
}

// Autocompletar email y departamento
function initQuiz() {
    // Verificar si estamos en la página del quiz
    const quizForm = document.getElementById('quizForm');
    
    // Si no existe el formulario, salir de la función
    if (!quizForm) {
        console.log('No estamos en la página del quiz, omitiendo inicialización');
        return;
    }
    
    const quizResults = document.getElementById('quizResults');
    const savedEmail = localStorage.getItem('userEmail') || '';
    const savedDepartment = localStorage.getItem('selectedDepartment') || '';

    if (savedEmail) {
        const emailField = document.getElementById('quizEmail');
        if (emailField) {
            emailField.value = savedEmail;
            emailField.readOnly = true; // Hacer el campo de solo lectura
        }
    }

    if (savedDepartment) {
        const deptSelect = document.getElementById('quizDepartment');
        if (deptSelect) {
            // Desactivar el select
            deptSelect.disabled = true;
            
            // Establecer la opción correcta
            const options = Array.from(deptSelect.options);
            const optionToSelect = options.find(option => option.text === savedDepartment);
            
            if (optionToSelect) {
                optionToSelect.selected = true;
            }
        }
    }
    
    // Manejar envío del formulario
    quizForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Validar que todas las preguntas estén respondidas
        const totalQuestions = 10;
        const formData = new FormData(quizForm);
        let allQuestionsAnswered = true;
        
        // Comprobar cada pregunta
        for (let i = 1; i <= totalQuestions; i++) {
            const questionName = `q${i}`;
            if (!formData.get(questionName)) {
                allQuestionsAnswered = false;
                break;
            }
        }
        
        // Si no están todas respondidas, mostrar alerta y detener envío
        if (!allQuestionsAnswered) {
            alert('Por favor, responde todas las preguntas antes de enviar el formulario.');
            return;
        }
        
        // Recopilar respuestas
        let correctAnswers = 0;
        const detailResponses = [];
        
        // Verificar respuestas
        for (let i = 1; i <= totalQuestions; i++) {
            const questionName = `q${i}`;
            const selectedValue = formData.get(questionName);
            const correctOption = document.querySelector(`input[name="${questionName}"][data-correct="true"]`);
            const isCorrect = correctOption && selectedValue === correctOption.value;
            
            if (isCorrect) correctAnswers++;
            
            detailResponses.push({
                question: i,
                selected: selectedValue,
                correct: isCorrect
            });
        }
        
        // Calcular puntuación
        const score = (correctAnswers / totalQuestions) * 100;
        
        // Preparar datos para enviar
        const quizData = {
            nombre: localStorage.getItem('userName'),
            email: document.getElementById('quizEmail').value,
            department: document.getElementById('quizDepartment').options[document.getElementById('quizDepartment').selectedIndex].text,
            score: score,
            correctAnswers: correctAnswers,
            totalQuestions: totalQuestions,
            detailResponses: detailResponses
        };
        
        // Enviar a Google Sheets
        const sendSuccess = await sendQuizResultsToGoogleSheets(quizData);
        
        // Guardar en localStorage para no perder datos si falla el envío
        AppState.quizScores = quizData;
        localStorage.setItem('quizScores', JSON.stringify(quizData));
        
        // Mostrar resultados
        document.getElementById('scoreValue').textContent = Math.round(score);
        document.getElementById('correctAnswers').textContent = correctAnswers;
    
    // Mensaje basado en la puntuación
    const scoreMessage = document.getElementById('scoreMessage');
    if (score >= 80) {
        scoreMessage.textContent = '¡Excelente! Has comprendido muy bien cómo utilizar la IA de forma segura y efectiva.';
    } else if (score >= 60) {
        scoreMessage.textContent = 'Buen trabajo. Tienes una comprensión general, pero conviene reforzar algunos conceptos.';
    } else {
        scoreMessage.textContent = 'Es recomendable repasar los conceptos clave para utilizar la IA con seguridad.';
    }
    
    // Generar recomendaciones
    generateRecommendations(detailResponses);
    
    // Mostrar resultados
    quizForm.style.display = 'none';
    quizResults.style.display = 'block';
    
    // Si el usuario ha aprobado (>70%), redirigir a página de felicitación
    if (score >= 70) {
        setTimeout(() => {
            window.location.href = 'congratulations.html';
        }, 5000); // Redirigir después de 5 segundos
    } else {
        setTimeout(() => {
            window.location.href = 'improve.html';
        }, 5000); // Redirigir después de 5 segundos
    }
});
    
// Solo agregar estos event listeners si los elementos existen
const restartButton = document.getElementById('restartQuiz');
if (restartButton) {
    restartButton.addEventListener('click', function() {
        quizForm.reset();
        quizForm.style.display = 'block';
        quizResults.style.display = 'none';
    });
}

const downloadButton = document.getElementById('downloadCertificate');
if (downloadButton) {
    downloadButton.addEventListener('click', function() {
        alert('La función de descarga de certificado estará disponible próximamente.');
    });
}

    // Botón para reiniciar el quiz
    document.getElementById('restartQuiz').addEventListener('click', function() {
        quizForm.reset();
        quizForm.style.display = 'block';
        quizResults.style.display = 'none';
    });
    
    // Botón para descargar certificado
    document.getElementById('downloadCertificate').addEventListener('click', function() {
        // Aquí puedes implementar la lógica para generar un certificado
        alert('La función de descarga de certificado estará disponible próximamente.');
    });
}

// Función para generar recomendaciones basadas en respuestas incorrectas
function generateRecommendations(detailResponses) {
    const recommendationsDiv = document.getElementById('recommendationsContent');
    const incorrectResponses = detailResponses.filter(response => !response.correct);
    
    if (incorrectResponses.length === 0) {
        recommendationsDiv.innerHTML = '<p>¡Felicidades! Has respondido correctamente a todas las preguntas. Estás listo para utilizar la IA de forma segura y efectiva.</p>';
        return;
    }
    
    let recommendationsHTML = '<ul>';
    
    incorrectResponses.forEach(response => {
        let recommendation = '';
        
        // Recomendaciones específicas según la pregunta
        switch(response.question) {
            case 1:
                recommendation = 'Revisa la sección de "Riesgos y Seguridad" para entender qué tipo de información nunca debe compartirse con ChatGPT.';
                break;
            case 2:
                recommendation = 'Consulta la sección "Guía de Uso" para comprender cómo formular prompts efectivos.';
                break;
            case 3:
                recommendation = 'Repasa la sección "Protocolo de Seguridad para MPS" para conocer las prácticas correctas al manejar datos de producción.';
                break;
            case 4:
                recommendation = 'Revisa las limitaciones de ChatGPT en la sección "Aplicaciones Prácticas Avanzadas".';
                break;
            case 5:
                recommendation = 'Consulta la sección "Trabajando con Documentos" para aprender técnicas de manejo de documentos extensos.';
                break;
            case 6:
                recommendation = 'Revisa el "Procedimiento de Notificación de Incidentes" en la sección de Riesgos y Seguridad.';
                break;
            case 7:
                recommendation = 'Consulta "Flujos de Trabajo Integrados" en la sección de Aplicaciones Prácticas Avanzadas.';
                break;
            case 8:
                recommendation = 'Revisa las mejores prácticas en "Integración con Herramientas Cotidianas".';
                break;
            case 9:
                recommendation = 'Consulta la "Matriz de Riesgo por Departamento" en la sección de Riesgos y Seguridad.';
                break;
            case 10:
                recommendation = 'Repasa las "Prácticas a Evitar" en la sección de Riesgos y Seguridad.';
                break;
        }
        
        recommendationsHTML += `<li><strong>Pregunta ${response.question}:</strong> ${recommendation}</li>`;
    });
    
    recommendationsHTML += '</ul>';
    recommendationsDiv.innerHTML = recommendationsHTML;
}

// Función para verificar el hash en la URL
function checkUrlHash() {
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
        const sectionId = hash.substring(1); // Quitar el símbolo #
        NavigationManager.navigateToSection(sectionId);
    }
}

// Inicialización de la aplicación con una sola función window.onload
window.onload = function() {
    StateManager.init();
    NavigationManager.init();
    
    // Verificar si estamos en la página del quiz antes de inicializarlo
    const quizSection = document.getElementById('quiz');
    if (quizSection) {
        console.log("Página del quiz detectada, inicializando quiz...");
        initQuiz();
    } else {
        console.log("No estamos en la página del quiz, omitiendo inicialización del quiz");
    }
    
    checkUrlHash(); // Verificar si hay un hash en la URL
    
    // Verificar si el usuario está autenticado
    if (!localStorage.getItem('selectedDepartment')) {
        window.location.href = 'Best_practices_MPS.html';
    }
    
    // Añadir esta función justo antes de nextSlide y prevSlide
    let slideIndex = 1;
    function showSlides(n) {
        try {
            const cards = document.querySelectorAll('.benefit-card');
            const dots = document.querySelectorAll('.dot');
            
            if (!cards.length || !dots.length) return;
            
            if (n > cards.length) {slideIndex = 1}
            if (n < 1) {slideIndex = cards.length}
            
            // Ocultar todas las tarjetas
            for (let i = 0; i < cards.length; i++) {
                cards[i].style.display = "none";
            }
            
            // Desactivar todos los puntos
            for (let i = 0; i < dots.length; i++) {
                dots[i].className = dots[i].className.replace(" active", "");
            }
            
            // Mostrar la tarjeta actual y activar el punto correspondiente
            cards[slideIndex-1].style.display = "block";
            dots[slideIndex-1].className += " active";
        } catch (error) {
            console.error('Error en showSlides:', error);
        }
    }
    
    // Inicializar el carrusel si está presente
    const cards = document.querySelectorAll('.benefit-card');
    if (cards.length > 0) {
        showSlides(1);
    }
};

function nextSlide() {
    showSlides(slideIndex += 1);
}

function prevSlide() {
    showSlides(slideIndex -= 1);
}

// Función para las pestañas (añadir después de nextSlide y prevSlide)
function showTab(tabId) {
    try {
        // Ocultar todos los contenidos de pestañas
        document.querySelectorAll('.tab-pane').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Desactivar todos los botones de pestañas
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });
        
        // Activar la pestaña seleccionada
        const tabElement = document.getElementById(tabId);
        if (tabElement) {
            tabElement.classList.add('active');
        }
        
        // Activar el botón correspondiente
        event.currentTarget.classList.add('active');
    } catch (error) {
        console.error('Error en showTab:', error);
    }
}

// Funciones para los ejemplos de departamentos
function showDepartmentExamples() {
    try {
        const select = document.getElementById('deptSelect');
        if (!select) return;
        
        const selectedDept = select.value;
        
        // Ocultar todos los ejemplos
        document.querySelectorAll('.dept-example-container').forEach(container => {
            container.style.display = 'none';
        });
        
        // Mostrar los ejemplos del departamento seleccionado
        if (selectedDept) {
            const deptExamples = document.getElementById(selectedDept + '-examples');
            if (deptExamples) {
                deptExamples.style.display = 'block';
            }
        }
    } catch (error) {
        console.error('Error en showDepartmentExamples:', error);
    }
}

function toggleExamples(element) {
    try {
        const examplesDiv = element.nextElementSibling;
        const isHidden = examplesDiv.style.display === 'none' || !examplesDiv.style.display;
        
        examplesDiv.style.display = isHidden ? 'block' : 'none';
        element.textContent = isHidden ? 'Ocultar ejemplos' : 'Ver ejemplos';
    } catch (error) {
        console.error('Error en toggleExamples:', error);
    }
}