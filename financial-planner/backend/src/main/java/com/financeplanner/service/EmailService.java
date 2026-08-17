package com.financeplanner.service;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender javaMailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    public void sendHtmlEmail(String to, String subject, String htmlBody) {
        try {
            log.info("[EmailService] Attempting to send email to: {} | Subject: {}", to, subject);
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail, "LI.FI Finance");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            javaMailSender.send(message);
            log.info("[EmailService] Email sent successfully to {}", to);
        } catch (Exception e) {
            log.error("[EmailService] FAILED to send email to {}: {}", to, e.getMessage(), e);
            throw new RuntimeException("Failed to send email: " + e.getMessage());
        }
    }

    public void sendOtpEmail(String to, String otp) {
        String subject = "Your Verification Code - Finance Planner";
        String htmlBody = "<html><body style='font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;'>" +
                "<div style='max-width: 500px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'>" +
                "<h2 style='color: #333; text-align: center;'>Welcome to LI.FI</h2>" +
                "<p style='color: #555; font-size: 16px; text-align: center;'>Use the verification code below to complete your registration:</p>" +
                "<div style='background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 6px; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #10b981; margin: 20px 0;'>" +
                otp + "</div>" +
                "<p style='color: #777; font-size: 14px; text-align: center;'>This code will expire in 5 minutes. Do not share this code with anyone.</p>" +
                "</div></body></html>";
        sendHtmlEmail(to, subject, htmlBody);
    }

    public void sendForgotPasswordEmail(String to, String tempPassword) {
        String subject = "Temporary Password Reset - Finance Planner";
        String htmlBody = "<html><body style='font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;'>" +
                "<div style='max-width: 500px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);'>" +
                "<h2 style='color: #333; text-align: center;'>Password Reset Request</h2>" +
                "<p style='color: #555; font-size: 16px; text-align: center;'>We received a request to reset your password. Here is your temporary password:</p>" +
                "<div style='background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 6px; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #ef4444; margin: 20px 0;'>" +
                tempPassword + "</div>" +
                "<p style='color: #777; font-size: 14px; text-align: center;'>Please login with this password and change it immediately from your profile settings.</p>" +
                "</div></body></html>";
        sendHtmlEmail(to, subject, htmlBody);
    }

    public void sendCoachHiringSuccessEmail(String to, String userName, String coachName) {
        String subject = "Purchase Successful - Coach Hired!";
        String htmlBody = "<html><body style='font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;'>" +
                "<div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.1); border-top: 6px solid #8b5cf6;'>" +
                "<div style='text-align: center; margin-bottom: 24px;'>" +
                "<span style='background-color: #ede9fe; color: #8b5cf6; padding: 12px 24px; border-radius: 50px; font-weight: bold; font-size: 14px; letter-spacing: 1px; text-transform: uppercase;'>Payment Confirmed</span>" +
                "</div>" +
                "<h2 style='color: #1f2937; text-align: center; font-size: 28px; margin-bottom: 12px;'>Congratulations, " + userName + "!</h2>" +
                "<p style='color: #4b5563; font-size: 16px; text-align: center; line-height: 1.6; margin-bottom: 24px;'>You have successfully completed your payment and hired your new Financial Coach.</p>" +
                "<div style='background: linear-gradient(135deg, #f3e8ff 0%, #e0e7ff 100%); padding: 24px; border-radius: 8px; margin: 32px 0; text-align: center;'>" +
                "<h3 style='color: #4338ca; margin: 0 0 8px 0; font-size: 20px;'>Your Coach: " + coachName + "</h3>" +
                "<p style='color: #4f46e5; margin: 0; font-size: 15px;'>They are now available to review your profile and chat with you directly in the LI.FI app!</p>" +
                "</div>" +
                "<p style='color: #6b7280; font-size: 14px; text-align: center; margin-top: 32px;'>Thank you for choosing LI.FI for your financial journey.</p>" +
                "</div></body></html>";
        sendHtmlEmail(to, subject, htmlBody);
    }
}
