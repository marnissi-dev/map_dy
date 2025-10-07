document.addEventListener('DOMContentLoaded', () => {
    const chatbotContainer = document.getElementById('chatbot-container');
    const closeChatbotBtn = document.getElementById('close-chatbot');
    const chatbotMessages = document.getElementById('chatbot-messages');
    const chatbotInputField = document.getElementById('chatbot-input-field');
    const chatbotSendBtn = document.getElementById('chatbot-send-btn');
    const chatbotToggleBtn = document.getElementById('chatbot-toggle-btn');

    // --- Event Listeners ---
    chatbotToggleBtn.addEventListener('click', () => {
        const isVisible = chatbotContainer.style.display === 'flex';
        chatbotContainer.style.display = isVisible ? 'none' : 'flex';
    });

    closeChatbotBtn.addEventListener('click', () => {
        chatbotContainer.style.display = 'none';
    });

    chatbotSendBtn.addEventListener('click', sendMessage);
    chatbotInputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // --- Functions ---
    function sendMessage() {
        const userMessage = chatbotInputField.value.trim();
        if (userMessage === '') return;

        displayMessage(userMessage, 'user');
        const botResponse = generateResponse(userMessage);
        displayMessage(botResponse, 'bot');

        chatbotInputField.value = '';
    }

    function displayMessage(message, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chatbot-message', `${sender}-message`);
        messageElement.textContent = message;
        chatbotMessages.appendChild(messageElement);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    function generateResponse(userMessage) {
        const lowerCaseMessage = userMessage.toLowerCase();

        if (lowerCaseMessage.includes('projets')) {
            return `Il y a ${allProjects.length} projets au total.`;
        } else if (lowerCaseMessage.includes('entreprises')) {
            return `Il y a ${companies.length} entreprises au total.`;
        } else if (lowerCaseMessage.includes('domaines')) {
            const domains = [...new Set(allProjects.map(p => p.domain))];
            return `Les domaines de recherche disponibles sont : ${domains.join(', ')}.`;
        } else if (lowerCaseMessage.includes('bonjour') || lowerCaseMessage.includes('salut')) {
            return 'Bonjour ! Comment puis-je vous aider ?';
        } else {
            return 'Désolé, je ne comprends pas. Essayez de poser une question sur les projets, les entreprises ou les domaines.';
        }
    }
});
