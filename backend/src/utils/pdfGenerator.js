// src/utils/pdfGenerator.js
import PDFDocument from 'pdfkit';

export const generateApplicationPDF = (application, history) => {
    const doc = new PDFDocument({ margin: 50 });

    // 1. Header
    doc.fontSize(20).font('Helvetica-Bold').text('Application Report', { align: 'center' });
    doc.moveDown();

    // 2. Application Details
    doc.fontSize(12).font('Helvetica-Bold').text('Application Details', { underline: true });
    doc.moveDown(0.5);
    
    doc.font('Helvetica').fontSize(10);
    doc.text(`Application ID: ${application.applicationId}`, { continued: true }).text(`  Date: ${new Date(application.submittedDate).toLocaleDateString()}`, { align: 'right' });
    doc.text(`Title: ${application.title}`);
    doc.text(`Type: ${application.applicationType.replace(/_/g, ' ').toUpperCase()}`);
    doc.text(`Status: ${application.status.toUpperCase()}`);
    doc.text(`Urgent: ${application.isUrgent ? 'Yes' : 'No'}`);
    
    doc.moveDown();

    // 3. Student Info
    doc.font('Helvetica-Bold').text('Student Information', { underline: true });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Name: ${application.student?.firstName} ${application.student?.lastName}`);
    doc.text(`Student ID: ${application.student?.studentId || 'N/A'}`);
    doc.text(`Email: ${application.student?.email}`);
    doc.text(`Department: ${application.department?.name || 'N/A'}`);

    doc.moveDown();

    // 4. Academic Verification (If exists)
    if (application.academicVerification && application.academicVerification.isVerified) {
        doc.font('Helvetica-Bold').text('Academic Verification (Examination Dept)', { underline: true });
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(10);
        doc.text(`Verified: Yes`);
        doc.text(`CGPA Recorded: ${application.academicVerification.cgpa}`);
        doc.text(`Remarks: ${application.academicVerification.remarks || 'None'}`);
        doc.moveDown();
    }

    // 5. Description
    doc.font('Helvetica-Bold').text('Description', { underline: true });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10).text(application.description, { width: 500, align: 'justify' });

    doc.moveDown();

    // 6. Final Remarks (if any)
    if (application.finalRemarks) {
        doc.font('Helvetica-Bold').text('Final Remarks', { underline: true });
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(10).text(application.finalRemarks, { width: 500, align: 'justify' });
        doc.moveDown();
    }

    // 7. History Log
    doc.font('Helvetica-Bold').text('Processing History', { underline: true });
    doc.moveDown(0.5);

    if (history && history.length > 0) {
        history.forEach((h) => {
            const date = new Date(h.timestamp).toLocaleString();
            const actionBy = h.actionBy?.firstName || 'System';
            doc.font('Helvetica-Bold').text(`${date}`, { continued: true });
            doc.font('Helvetica').text(` - ${h.action.toUpperCase()} by ${actionBy}`);
            if (h.remarks) {
                doc.text(`   Remarks: ${h.remarks}`);
            }
        });
    } else {
        doc.font('Helvetica').text('No history available.');
    }

    // Finalize
    doc.end();
    return doc;
};