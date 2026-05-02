document.addEventListener('DOMContentLoaded', function() {
  const continueBtn = document.getElementById('continueBtn');
  if (continueBtn) {
    continueBtn.addEventListener('click', function() {
      const email = (document.getElementById('emailInput') || {}).value || '';
      if (!email || !email.includes('@')) { alert('Please enter a valid email.'); return; }
      document.getElementById('emailSection').style.display = 'none';
      document.getElementById('formSection').style.display = '';
    });
  }

  
});