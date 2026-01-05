function renderPersonalHistory() {
    const history = state.myPlacementHistory;
    const historyContainer = elements.personalHistory;
    const listContainer = elements.historyList;

    // Only show if we have placed cards
    if (!history || history.length === 0) {
        historyContainer.classList.add('hidden');
        return;
    }

    historyContainer.classList.remove('hidden');

    // Clear current list
    listContainer.innerHTML = '';

    // Render items (bottom to top)
    history.forEach((cardType, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        // Use text or small icon
        // item.textContent = cardType === 'skull' ? '💀' : '🌸';

        // Let's use words or small colored dots/icons
        // User requested: "Flower -> Flower -> Skull"
        // Let's make it looks nice.

        const text = cardType === 'skull' ? 'Skull' : 'Flower';
        const typeClass = cardType;

        item.innerHTML = `<span class="history-type ${typeClass}">${text}</span>`;

        if (index < history.length - 1) {
            const arrow = document.createElement('span');
            arrow.className = 'history-arrow';
            arrow.textContent = '→';
            listContainer.appendChild(item);
            listContainer.appendChild(arrow);
        } else {
            listContainer.appendChild(item);
        }
    });
}
