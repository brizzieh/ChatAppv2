document.addEventListener("DOMContentLoaded", function () {
  const button = document.getElementById("emoji-picker");
  const input = document.getElementById("message-input");
  let picker = null;

  if (!button || !input) return;

  button.addEventListener("click", async (e) => {
    e.preventDefault();

    // If picker already exists, remove it and return
    if (picker) {
      picker.remove();
      picker = null;
      return;
    }

    // Dynamically import the picker
    const { Picker } = await import(
      "https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js"
    );

    picker = new Picker();

    // Handle emoji selection
    picker.addEventListener("emoji-click", (event) => {
      input.value += event.detail.unicode;
      input.focus();

      // Remove the picker after selection
      //picker.remove();
      // picker = null;
    });

    // Position the picker relative to the button
    const buttonRect = button.getBoundingClientRect();
    
    // Mobile-specific positioning
    if (window.innerWidth <= 768) {
        // Position below the button on mobile
        picker.style.position = 'fixed';
        picker.style.bottom = '80px'; // Above mobile keyboard if present
        picker.style.left = '10px';
        picker.style.right = '10px';
        picker.style.width = 'calc(100% - 20px)';
        picker.style.maxHeight = '300px';
    } else {
        // Desktop positioning (original)
        picker.style.position = 'absolute';
        picker.style.right = '0';
        picker.style.bottom = '40px';
    }
    
    picker.style.zIndex = '1000';

    // Close picker when clicking outside
    document.addEventListener("click", function outsideClickHandler(e) {
      if (!picker.contains(e.target) && e.target !== button) {
        picker.remove();
        picker = null;
        document.removeEventListener("click", outsideClickHandler);
      }
    });

    document.body.appendChild(picker);
  });
});
