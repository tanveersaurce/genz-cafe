import path from 'path';
import PDFDocument from 'pdfkit';
import { IMonthlyStatement } from './models/monthlyStatement.model';
import { Partner } from '../partners/models/partner.model';

export const pdfGeneratorService = {
  /**
   * Generates a monthly partner statement PDF buffer.
   */
  async generateStatementPdf(statement: IMonthlyStatement): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `Gen-Z Cafe - Statement ${statement.statementNo}`,
            Author: 'Gen-Z Cafe ERP',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const fontPath = path.resolve(__dirname, '../../assets/fonts/UnicodeIndic.ttc');

        // Fetch partner details for PAN / bank details snapshot
        const partnerIds = statement.allocations.map((a) => a.partnerId);
        const partners = await Partner.find({ _id: { $in: partnerIds } }).lean();
        const partnerMap = new Map(partners.map((p) => [p._id.toString(), p]));

        // --- Colors ---
        const brandGreen = '#162a1f';
        const brandGold = '#b38b40';
        const darkText = '#1f2937';
        const mutedText = '#6b7280';
        const tableBorder = '#e5e7eb';
        const tableBg = '#f9fafb';

        // --- Header Banner ---
        doc.rect(40, 40, 515, 65).fill(brandGreen);

        doc.fillColor('#ffffff').fontSize(20).font(fontPath, 'NirmalaUI-Bold');
        doc.text('GEN-Z CAFE', 55, 52);

        doc.fillColor(brandGold).fontSize(10).font(fontPath, 'NirmalaUI');
        doc.text('PARTNER PROFIT SHARE STATEMENT', 55, 76);

        // Header right-side info
        doc.fillColor('#ffffff').fontSize(11).font(fontPath, 'NirmalaUI-Bold');
        doc.text(statement.statementNo, 380, 52, { align: 'right', width: 160 });

        doc.fillColor('#d1d5db').fontSize(9).font(fontPath, 'NirmalaUI');
        doc.text(`Month: ${statement.month}`, 380, 68, { align: 'right', width: 160 });
        doc.text(
          `Status: ${statement.status.toUpperCase()} (v${statement.version})`,
          380,
          82,
          { align: 'right', width: 160 }
        );

        let y = 120;

        // --- Statement Meta Grid ---
        doc.rect(40, y, 515, 45).fillAndStroke(tableBg, tableBorder);
        doc.fillColor(darkText).fontSize(8.5).font(fontPath, 'NirmalaUI');

        doc.text(`Financial Month: ${statement.month}`, 50, y + 10);
        doc.text(
          `Finalized At: ${statement.finalizedAt ? new Date(statement.finalizedAt).toLocaleDateString('en-IN') : 'Draft'}`,
          50,
          y + 26
        );

        doc.text(`Direct Costs / COGS: ₹${(statement.totals.directCosts / 100).toFixed(2)}`, 220, y + 10);
        doc.text(`Operating Expenses: ₹${(statement.totals.operatingExpenses / 100).toFixed(2)}`, 220, y + 26);

        doc.text(`Net Revenue: ₹${(statement.totals.netRevenue / 100).toFixed(2)}`, 400, y + 10);
        doc.font(fontPath, 'NirmalaUI-Bold');
        doc.text(
          `Net Profit: ₹${(statement.totals.netProfit / 100).toFixed(2)}`,
          400,
          y + 26
        );

        y += 60;

        // --- Section 1: Financial Performance Summary ---
        doc.fillColor(brandGreen).fontSize(12).font(fontPath, 'NirmalaUI-Bold');
        doc.text('1. PROFIT & LOSS SUMMARY (EX-GST)', 40, y);
        y += 18;

        const pnlRows = [
          ['Gross Sales', `₹${(statement.totals.grossSales / 100).toFixed(2)}`],
          ['Discounts Allowed', `₹${(statement.totals.discounts / 100).toFixed(2)}`],
          ['Net Revenue (Ex-GST)', `₹${(statement.totals.netRevenue / 100).toFixed(2)}`],
          ['GST Collected', `₹${(statement.totals.totalTax / 100).toFixed(2)}`],
          ['Direct Costs (Raw Material & COGS Purchases)', `₹${(statement.totals.directCosts / 100).toFixed(2)}`],
          ['Operating Expenses (Payroll, Rent, Utilities, etc.)', `₹${(statement.totals.operatingExpenses / 100).toFixed(2)}`],
          ['Net Profit / (Loss)', `₹${(statement.totals.netProfit / 100).toFixed(2)}`],
        ];

        doc.rect(40, y, 515, pnlRows.length * 18 + 4).stroke(tableBorder);
        pnlRows.forEach((row, idx) => {
          const rowY = y + 4 + idx * 18;
          if (idx % 2 === 1) {
            doc.rect(41, rowY - 2, 513, 18).fill('#f9fafb');
          }
          const isBold = idx === 2 || idx === 6;
          doc.fillColor(isBold ? brandGreen : darkText)
            .fontSize(8.5)
            .font(fontPath, isBold ? 'NirmalaUI-Bold' : 'NirmalaUI');
          doc.text(row[0] || '', 50, rowY);
          doc.text(row[1] || '', 400, rowY, { align: 'right', width: 140 });
        });

        y += pnlRows.length * 18 + 20;

        // --- Section 2: Distribution & Reserves ---
        doc.fillColor(brandGreen).fontSize(12).font(fontPath, 'NirmalaUI-Bold');
        doc.text('2. PROFIT ALLOCATION & RESERVES', 40, y);
        y += 18;

        doc.rect(40, y, 515, 36).fillAndStroke(tableBg, tableBorder);
        doc.fillColor(darkText).fontSize(9).font(fontPath, 'NirmalaUI');
        doc.text(`Retained Cafe Reserves: ₹${(statement.retainedAmount / 100).toFixed(2)}`, 50, y + 12);
        doc.font(fontPath, 'NirmalaUI-Bold');
        doc.text(
          `Total Distributable Profit: ₹${(statement.distributableAmount / 100).toFixed(2)}`,
          300,
          y + 12,
          { align: 'right', width: 240 }
        );

        y += 48;

        // --- Section 3: Partner Share Breakdown Table ---
        doc.fillColor(brandGreen).fontSize(12).font(fontPath, 'NirmalaUI-Bold');
        doc.text('3. PARTNER ALLOCATION SCHEDULE', 40, y);
        y += 18;

        // Table Header
        doc.rect(40, y, 515, 20).fill(brandGreen);
        doc.fillColor('#ffffff').fontSize(8.5).font(fontPath, 'NirmalaUI-Bold');
        doc.text('Partner Name', 50, y + 5);
        doc.text('PAN', 210, y + 5);
        doc.text('Share %', 320, y + 5, { align: 'right', width: 70 });
        doc.text('Allocated Amount', 420, y + 5, { align: 'right', width: 120 });
        y += 20;

        statement.allocations.forEach((alloc, idx) => {
          const partnerDoc = partnerMap.get(alloc.partnerId.toString());
          const rowY = y + idx * 22;

          if (idx % 2 === 1) {
            doc.rect(40, rowY, 515, 22).fill('#f9fafb');
          }
          doc.rect(40, rowY, 515, 22).stroke(tableBorder);

          doc.fillColor(darkText).fontSize(8.5).font(fontPath, 'NirmalaUI-Bold');
          doc.text(alloc.partnerNameSnapshot, 50, rowY + 6);

          doc.fillColor(mutedText).fontSize(8).font(fontPath, 'NirmalaUI');
          doc.text(partnerDoc?.pan || 'N/A', 210, rowY + 6);

          doc.fillColor(darkText).fontSize(8.5).font(fontPath, 'NirmalaUI');
          doc.text(`${(alloc.basisPoints / 100).toFixed(2)}%`, 320, rowY + 6, { align: 'right', width: 70 });

          const isNegative = alloc.amount < 0;
          doc.fillColor(isNegative ? '#dc2626' : brandGreen).font(fontPath, 'NirmalaUI-Bold');
          doc.text(
            `${isNegative ? '-' : ''}₹${(Math.abs(alloc.amount) / 100).toFixed(2)}`,
            420,
            rowY + 6,
            { align: 'right', width: 120 }
          );
        });

        y += statement.allocations.length * 22 + 25;

        // --- Section 4: Audit Verification & Checksum ---
        doc.rect(40, y, 515, 55).fillAndStroke('#f3f4f6', tableBorder);
        doc.fillColor(brandGreen).fontSize(8).font(fontPath, 'NirmalaUI-Bold');
        doc.text('AUDIT & INTEGRITY VERIFICATION (PERIOD LOCKED)', 50, y + 8);

        doc.fillColor(mutedText).fontSize(7).font(fontPath, 'NirmalaUI');
        doc.text(`SHA-256 Checksum: ${statement.checksum}`, 50, y + 22);
        doc.text(
          'This statement has been electronically finalized and locked. Subsequent transactions for this month are strictly prohibited under system integrity rules.',
          50,
          y + 34,
          { width: 495 }
        );

        // --- Footer ---
        doc.fillColor(mutedText).fontSize(7.5).font(fontPath, 'NirmalaUI');
        doc.text(
          `Generated automatically by Gen-Z Cafe ERP on ${new Date().toISOString()}`,
          40,
          770,
          { align: 'center', width: 515 }
        );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },
};
