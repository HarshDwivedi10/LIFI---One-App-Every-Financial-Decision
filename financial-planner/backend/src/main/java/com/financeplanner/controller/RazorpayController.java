package com.financeplanner.controller;

import com.financeplanner.entity.CoachProfile;
import com.financeplanner.entity.User;
import com.financeplanner.repository.CoachProfileRepository;
import com.financeplanner.repository.UserRepository;
import com.financeplanner.service.CoachService;
import com.financeplanner.service.EmailService;
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
    private final EmailService emailService;

    public RazorpayController(UserRepository userRepository, CoachProfileRepository coachProfileRepository, CoachService coachService, EmailService emailService) {
        this.userRepository = userRepository;
        this.coachProfileRepository = coachProfileRepository;
        this.coachService = coachService;
        this.emailService = emailService;
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
        System.out.println("=== [RAZORPAY] verify-payment CALLED ===");
        System.out.println("[RAZORPAY] Authenticated user: " + (user != null ? user.getEmail() : "NULL - NOT AUTHENTICATED"));
        System.out.println("[RAZORPAY] Payload keys: " + payload.keySet());

        if (user == null) {
            System.err.println("[RAZORPAY] REJECTED: No authenticated user found in request.");
            return ResponseEntity.status(401).body(Map.of("error", "User not authenticated"));
        }

        try {
            String razorpayOrderId = payload.get("razorpay_order_id");
            String razorpayPaymentId = payload.get("razorpay_payment_id");
            String razorpaySignature = payload.get("razorpay_signature");
            String coachIdStr = payload.get("coachId");

            System.out.println("[RAZORPAY] orderId=" + razorpayOrderId);
            System.out.println("[RAZORPAY] paymentId=" + razorpayPaymentId);
            System.out.println("[RAZORPAY] coachId=" + coachIdStr);
            System.out.println("[RAZORPAY] signature present=" + (razorpaySignature != null && !razorpaySignature.isEmpty()));

            JSONObject options = new JSONObject();
            options.put("razorpay_order_id", razorpayOrderId);
            options.put("razorpay_payment_id", razorpayPaymentId);
            options.put("razorpay_signature", razorpaySignature);

            boolean isSignatureValid = Utils.verifyPaymentSignature(options, keySecret);
            System.out.println("[RAZORPAY] Signature valid: " + isSignatureValid);

            if (isSignatureValid) {
                Long coachId = Long.parseLong(coachIdStr);

                // Find coach User by userId or profileId
                User coachUser = userRepository.findById(coachId).orElse(null);
                if (coachUser == null) {
                    CoachProfile profile = coachProfileRepository.findById(coachId).orElse(null);
                    if (profile != null) coachUser = profile.getUser();
                }

                System.out.println("[RAZORPAY] Coach found: " + (coachUser != null ? coachUser.getName() : "NOT FOUND"));

                if (coachUser != null) {
                    coachService.hireCoach(user.getId(), coachUser.getId());
                    System.out.println("[RAZORPAY] Coach hired successfully. Now sending email to: " + user.getEmail());

                    // Send beautiful success email
                    try {
                        emailService.sendCoachHiringSuccessEmail(user.getEmail(), user.getName(), coachUser.getName());
                        System.out.println("[RAZORPAY] Email triggered successfully for: " + user.getEmail());
                    } catch (Exception emailEx) {
                        emailEx.printStackTrace();
                        System.err.println("[RAZORPAY] Email FAILED for: " + user.getEmail() + " | Reason: " + emailEx.getMessage());
                    }
                } else {
                    return ResponseEntity.badRequest().body(Map.of("error", "Coach user not found for ID: " + coachId));
                }

                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "message", "Payment verified successfully. Coach hired!",
                        "paymentId", razorpayPaymentId
                ));
            } else {
                System.err.println("[RAZORPAY] Signature INVALID. Payment rejected.");
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid payment signature. Verification failed."));
            }
        } catch (Exception e) {
            e.printStackTrace();
            System.err.println("[RAZORPAY] Exception in verifyPayment: " + e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("error", "Verification failed: " + e.getMessage()));
        }
    }
}
