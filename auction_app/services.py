import os
import base64
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from django.conf import settings
from django.core.files.base import ContentFile
import io
import logging

logger = logging.getLogger(__name__)

def send_confirmation_email(seller, buyer, auction):
    try:
        logger.info(f"Starting email send process for auction {auction.id}")
        logger.info(f"Seller email: {seller.email}, Buyer email: {buyer.email}")
        
        if not hasattr(settings, 'SENDGRID_API_KEY'):
            logger.error("SENDGRID_API_KEY not found in settings")
            return False
            
        if not hasattr(settings, 'FROM_EMAIL'):
            logger.error("FROM_EMAIL not found in settings")
            return False
            
        logger.info(f"SendGrid API Key exists: {bool(settings.SENDGRID_API_KEY)}")
        logger.info(f"From email: {settings.FROM_EMAIL}")
        
        message = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=[seller.email, buyer.email],
            subject=f'Auction Completed - {auction.item_name}',
            html_content=f'''
            <h2>Auction Completed Successfully!</h2>
            <p>Item: {auction.item_name}</p>
            <p>Final Price: ${auction.current_highest_bid}</p>
            <p>Seller: {seller.username}</p>
            <p>Buyer: {buyer.username}</p>
            '''
        )
        
        logger.info("Mail object created successfully")
        
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        logger.info("SendGrid client created")
        
        response = sg.send(message)
        logger.info(f"SendGrid response status: {response.status_code}")
        logger.info(f"SendGrid response body: {response.body}")
        logger.info(f"SendGrid response headers: {response.headers}")
        
        if response.status_code == 202:
            logger.info("Email sent successfully!")
            return True
        else:
            logger.error(f"Email sending failed with status: {response.status_code}")
            return False
            
    except Exception as e:
        logger.error(f"Email sending failed with exception: {e}", exc_info=True)
        return False

def generate_invoice(auction):
    try:
        logger.info(f"Starting invoice generation for auction {auction.id}")
        
        if not auction.winner:
            logger.error("No winner found for auction")
            return False
            
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)
        
        p.drawString(100, 750, f"INVOICE - {auction.item_name}")
        p.drawString(100, 720, f"Seller: {auction.seller.username}")
        p.drawString(100, 700, f"Buyer: {auction.winner.username}")
        p.drawString(100, 680, f"Amount: ${auction.current_highest_bid}")
        p.drawString(100, 660, f"Date: {auction.end_time().strftime('%Y-%m-%d')}")
        
        p.showPage()
        p.save()
        
        buffer.seek(0)
        logger.info("PDF invoice created successfully")
        
        message = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=[auction.seller.email, auction.winner.email],
            subject=f'Invoice - {auction.item_name}',
            html_content='Please find your invoice attached.'
        )
        
        message.attachment = Attachment(
            FileContent(base64.b64encode(buffer.getvalue()).decode()),
            FileName(f'invoice_{auction.id}.pdf'),
            FileType('application/pdf'),
            Disposition('attachment')
        )
        
        logger.info("Invoice email with attachment created")
        
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        response = sg.send(message)
        
        logger.info(f"Invoice email response status: {response.status_code}")
        
        if response.status_code == 202:
            logger.info("Invoice email sent successfully!")
            return True
        else:
            logger.error(f"Invoice email failed with status: {response.status_code}")
            return False
        
    except Exception as e:
        logger.error(f"Invoice generation failed with exception: {e}", exc_info=True)
        return False
