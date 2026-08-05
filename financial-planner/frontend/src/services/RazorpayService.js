import api from './api';
import toast from 'react-hot-toast';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const initiateRazorpayCheckout = async ({ coach, amount, currentUser, onSuccess, onError }) => {
  try {
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      toast.error('Failed to load Razorpay SDK. Please check your network connection.');
      return;
    }

    const toastId = toast.loading('Initiating Razorpay payment...');

    // 1. Create order on backend
    const res = await api.post('/razorpay/create-order', {
      coachId: coach.id,
      amount: amount || coach.consultationFee || 1999
    });

    const { orderId, keyId, currency } = res.data;
    toast.dismiss(toastId);

    // 2. Open Razorpay Official Modal
    const options = {
      key: keyId || 'rzp_test_TMEtsOZdHmnGet',
      amount: res.data.amount,
      currency: currency || 'INR',
      name: 'LiFi Financial Planner',
      description: `Hiring Coach ${coach.name}`,
      order_id: orderId,
      prefill: {
        name: currentUser?.name || 'Test User',
        email: currentUser?.email || 'user@example.com',
        contact: currentUser?.phone || '9876543210',
        method: 'upi'
      },
      config: {
        display: {
          blocks: {
            upi_block: {
              name: 'Pay via UPI / GPay / PhonePe / Paytm',
              instruments: [
                {
                  method: 'upi'
                }
              ]
            },
            other_block: {
              name: 'Cards & Netbanking',
              instruments: [
                { method: 'card' },
                { method: 'netbanking' }
              ]
            }
          },
          sequence: ['block.upi_block', 'block.other_block'],
          preferences: {
            show_default_blocks: true
          }
        }
      },
      theme: {
        color: '#7c3aed'
      },
      handler: async (response) => {
        const verifyToastId = toast.loading('Verifying payment signature with Razorpay...');
        try {
          const verifyRes = await api.post('/razorpay/verify-payment', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            coachId: coach.id.toString()
          });

          toast.dismiss(verifyToastId);
          toast.success(`🎉 Payment Successful! ${coach.name} has been hired!`);
          if (onSuccess) onSuccess(verifyRes.data);
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } catch (err) {
          toast.dismiss(verifyToastId);
          console.error(err);
          toast.error('Payment verification failed.');
          if (onError) onError(err);
        }
      },
      modal: {
        ondismiss: () => {
          toast('Payment cancelled.', { icon: 'ℹ️' });
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response) {
      toast.error(`Payment failed: ${response.error.description}`);
      if (onError) onError(response.error);
    });

    rzp.open();
  } catch (err) {
    console.error('Razorpay initiation error:', err);
    toast.error('Failed to initiate payment.');
    if (onError) onError(err);
  }
};
