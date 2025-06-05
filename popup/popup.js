/**
 * Popup script for Prompt-Scrubber
 */
document.addEventListener('DOMContentLoaded', () => {
  const toggleElement = document.getElementById('toggle');
  const toggleStatus = document.getElementById('toggle-status');
  
  // Get current state from storage
  chrome.storage.sync.get('enabled', result => {
    const enabled = result.hasOwnProperty('enabled') ? result.enabled : true;
    
    // Set toggle to match current state
    toggleElement.checked = enabled;
    updateToggleStatus(enabled);
  });
  
  // Send message to active tab when toggle changes
  toggleElement.addEventListener('change', () => {
    const enabled = toggleElement.checked;
    
    // Update the toggle status text
    updateToggleStatus(enabled);
    
    // Save to storage
    chrome.storage.sync.set({ enabled });
    
    // Send message to all tabs
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'setState', 
          enabled 
        }).catch(() => {
          // Ignore errors for tabs where content script isn't loaded
        });
      });
    });
  });
  
  /**
   * Update the toggle status text
   * @param {boolean} enabled - Whether protection is enabled
   */
  function updateToggleStatus(enabled) {
    toggleStatus.textContent = enabled ? 'Enabled' : 'Disabled';
    toggleStatus.className = enabled ? '' : 'disabled';
  }
});