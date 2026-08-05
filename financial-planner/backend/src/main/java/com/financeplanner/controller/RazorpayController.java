package com.financeplanner.controller;

import com.financeplanner.entity.CoachProfile;
import com.financeplanner.entity.User;
import com.financeplanner.repository.CoachProfileRepository;
import com.financeplanner.repository.UserRepository;
import com.financeplanner.service.CoachService;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.Utils;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/razorpay")
public class RazorpayController {

    @Value("${razorpay.key_id:rzp_test_TMEtsOZdHmnGet}")
    private String keyId;

    @Value("${razorpay.key_secret:shoRimI0kV40gpf7kn3AIMaD}")
    private String keySecret;

    private final UserRepository userRepository;
    private final CoachProfileRepository coachProfileRepository;
    private final CoachService coachService;

    public RazorpayController(UserRepository userRepository, CoachProfileRepository coachProfileRepository, CoachService coachService) {
        this.userRepository = userRepository;
        this.coachProfileRepository = coachProfileRepository;
        this.coachService = coachService;
    }

    @PostMapping("/create-order")
    public ResponseEntity<?> createOrder(@RequestBody Map<String, Object> req, @AuthenticationPrincipal User user) {
        try {
            Object coachIdObj = req.get("coachId");
            if (coachIdObj == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Missing coachId in request"));
            }

            Long coachId = Long.parseLong(coachIdObj.toString());
            double amountInRupees = Double.parseDouble(req.getOrDefault("amount", 1999).toString());
            
            // Amount in paise for Razorpay (e.g. 1999 INR = 199900 paise)
            long amountInPaise = Math.round(amountInRupees * 100);

            RazorpayClient client = new RazorpayClient(keyId, keySecret);
            JSONObject orderReq = new JSONObject();
            orderReq.put("amount", amountInPaise);
            orderReq.put("currency", "INR");
            orderReq.put("receipt", "rcpt_c_" + coachId + "_" + System.currentTimeMillis());

            Order order = client.orders.create(orderReq);

            Map<String, Object> response = Map.of(
                    "orderId", order.get("id"),
                    "amount", amountInPaise,
                    "currency", "INR",
                    "keyId", keyId
            );
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to create Razorpay order: " + e.getMessage()));
        }
    }

    @PostMapping("/verify-payment")
    public ResponseEntity<?> verifyPayment(@RequestBody Map<String, String> payload, @AuthenticationPrincipal User user) {
        try {
            String razorpayOrderId = payload.get("razorpay_order_id");
            String razorpayPaymentId = payload.get("razorpay_payment_id");
            String razorpaySignature = payload.get("razorpay_signature");
            String coachIdStr = payload.get("coachId");

            JSONObject options = new JSONObject();
            options.put("razorpay_order_id", razorpayOrderId);
            options.put("razorpay_payment_id", razorpayPaymentId);
            options.put("razorpay_signature", razorpaySignature);

            boolean isSignatureValid = Utils.verifyPaymentSignature(options, keySecret);

            if (isSignatureValid) {
                Long coachId = Long.parseLong(coachIdStr);

                // Find coach User by userId or profileId
                User coachUser = userRepository.findById(coachId).orElse(null);
                if (coachUser == null) {
                    CoachProfile profile = coachProfileRepository.findById(coachId).orElse(null);
                    if (profile != null) coachUser = profile.getUser();
                }

                if (coachUser != null) {
                    coachService.hireCoach(user.getId(), coachUser.getId());
                } else {
                    return ResponseEntity.badRequest().body(Map.of("error", "Coach user not found for ID: " + coachId));
                }

                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "message", "Payment verified successfully. Coach hired!",
                        "paymentId", razorpayPaymentId
                ));
            } else {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid payment signature. Verification failed."));
            }
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", "Verification failed: " + e.getMessage()));
        }
    }
}
