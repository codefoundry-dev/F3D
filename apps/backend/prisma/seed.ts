import { randomUUID } from 'crypto';

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Platform company (for SuperAdmin) ────────────────────────────────────
  const platformCompany = await prisma.company.upsert({
    where: { abn: 'FORETHREAD-PLATFORM' },
    update: {},
    create: {
      type: 'CONTRACTOR',
      legalName: 'Forethread Platform',
      tradeName: 'Forethread',
      abn: 'FORETHREAD-PLATFORM',
      contactEmail: 'platform@forethread.local',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Platform company:', platformCompany.legalName);

  // ── Super Admin user ─────────────────────────────────────────────────────
  const superAdminHash = await argon2.hash('Dev@123456');

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@forethread.local' },
    update: {},
    create: {
      email: 'superadmin@forethread.local',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      passwordHash: superAdminHash,
      companyId: platformCompany.id,
    },
  });

  console.log('✅ Super Admin:', superAdmin.email);

  // ── Test Contractor company ───────────────────────────────────────────────
  const contractorCompany = await prisma.company.upsert({
    where: { abn: 'TEST-CONTRACTOR-001' },
    update: {},
    create: {
      type: 'CONTRACTOR',
      legalName: 'Test Contractor Pty Ltd',
      tradeName: 'TestCo',
      abn: 'TEST-CONTRACTOR-001',
      contactEmail: 'admin@testcontractor.local',
      status: 'ACTIVE',
      specialisations: ['Civil', 'Infrastructure'],
    },
  });

  console.log('✅ Contractor company:', contractorCompany.legalName);

  // ── Test Vendor company ───────────────────────────────────────────────────
  const vendorCompany = await prisma.company.upsert({
    where: { abn: 'TEST-VENDOR-001' },
    update: {},
    create: {
      type: 'VENDOR',
      legalName: 'Test Vendor Pty Ltd',
      tradeName: 'VendorCo',
      abn: 'TEST-VENDOR-001',
      contactEmail: 'admin@testvendor.local',
      status: 'ACTIVE',
      specialisations: ['Materials', 'Equipment'],
      legalAddress: '12 Steel Lane, Penrith NSW 2750',
    },
  });

  console.log('✅ Vendor company:', vendorCompany.legalName);

  // ── Test users (Invited — activate via email link) ─────────────────────
  const testUsers = [
    {
      email: 'companyadmin@testcontractor.local',
      name: 'Company Admin',
      role: 'COMPANY_ADMIN' as const,
      companyId: contractorCompany.id,
    },
    {
      email: 'procurement@testcontractor.local',
      name: 'Procurement Officer',
      role: 'PROCUREMENT_OFFICER' as const,
      companyId: contractorCompany.id,
    },
    {
      email: 'financial@testcontractor.local',
      name: 'Financial Officer',
      role: 'FINANCIAL_OFFICER' as const,
      companyId: contractorCompany.id,
    },
    {
      email: 'vendor@testvendor.local',
      name: 'Vendor User',
      role: 'VENDOR' as const,
      companyId: vendorCompany.id,
    },
    {
      email: 'warehouse@testcontractor.local',
      name: 'Warehouse Officer',
      role: 'WAREHOUSE_OFFICER' as const,
      companyId: contractorCompany.id,
    },
    {
      email: 'foreman@testcontractor.local',
      name: 'Foreman',
      role: 'FOREMAN' as const,
      companyId: contractorCompany.id,
    },
  ];

  for (const userData of testUsers) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        status: 'INVITED',
        invitedByUserId: superAdmin.id,
        invitationToken: `seed-token-${userData.email}`,
        invitationTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    console.log(`✅ ${user.role}: ${user.email} (status: ${user.status})`);
  }

  // ── Activate contractor test users for project testing ────────────────────
  const testPasswordHash = await argon2.hash('Dev@123456');

  const companyAdmin = await prisma.user.update({
    where: { email: 'companyadmin@testcontractor.local' },
    data: {
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      invitationToken: null,
      invitationTokenExpiresAt: null,
    },
  });
  console.log(`✅ Activated: ${companyAdmin.email}`);

  const procurementOfficer = await prisma.user.update({
    where: { email: 'procurement@testcontractor.local' },
    data: {
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      invitationToken: null,
      invitationTokenExpiresAt: null,
    },
  });
  console.log(`✅ Activated: ${procurementOfficer.email}`);

  const financialOfficer = await prisma.user.update({
    where: { email: 'financial@testcontractor.local' },
    data: {
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      invitationToken: null,
      invitationTokenExpiresAt: null,
    },
  });
  console.log(`✅ Activated: ${financialOfficer.email}`);

  const warehouseOfficer = await prisma.user.update({
    where: { email: 'warehouse@testcontractor.local' },
    data: {
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      invitationToken: null,
      invitationTokenExpiresAt: null,
    },
  });
  console.log(`✅ Activated: ${warehouseOfficer.email}`);

  const foreman = await prisma.user.update({
    where: { email: 'foreman@testcontractor.local' },
    data: {
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      invitationToken: null,
      invitationTokenExpiresAt: null,
    },
  });
  console.log(`✅ Activated: ${foreman.email}`);

  // ── Test Projects ────────────────────────────────────────────────────────

  const alphaProject = await prisma.project.upsert({
    where: {
      companyId_name: {
        companyId: contractorCompany.id,
        name: 'Alpha Construction',
      },
    },
    update: {},
    create: {
      companyId: contractorCompany.id,
      name: 'Alpha Construction',
      description: 'Main construction project for the new office building',
      type: 'Commercial',
      status: 'PLANNED',
      plannedBudget: 500000,
      currency: 'AUD',
      startDate: new Date('2026-03-01'),
      expectedEndDate: new Date('2026-09-30'),
      createdByUserId: companyAdmin.id,
      pointOfContactId: procurementOfficer.id,
    },
  });

  // Alpha Project locations
  const alphaLocationsExist = await prisma.projectLocation.count({
    where: { projectId: alphaProject.id },
  });
  if (alphaLocationsExist === 0) {
    await prisma.projectLocation.createMany({
      data: [
        {
          projectId: alphaProject.id,
          type: 'DELIVERY',
          address: '123 Main St, Sydney NSW 2000',
          label: 'Site A - Main Entrance',
          isDefault: true,
        },
        {
          projectId: alphaProject.id,
          type: 'DELIVERY',
          address: '125 Main St, Sydney NSW 2000',
          label: 'Site B - Loading Dock',
          isDefault: false,
        },
        {
          projectId: alphaProject.id,
          type: 'STORAGE',
          address: 'Warehouse B, 45 Industrial Ave, Parramatta NSW 2150',
          label: 'Warehouse B',
          isDefault: true,
        },
      ],
    });
  }

  // Alpha Project members (CompanyAdmin + ProcurementOfficer, NOT FinancialOfficer)
  for (const userId of [companyAdmin.id, procurementOfficer.id]) {
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId: alphaProject.id, userId },
      },
      update: {},
      create: {
        projectId: alphaProject.id,
        userId,
        assignedByUserId: companyAdmin.id,
      },
    });
  }

  console.log(`✅ Project: ${alphaProject.name} (${alphaProject.status})`);

  const betaProject = await prisma.project.upsert({
    where: {
      companyId_name: {
        companyId: contractorCompany.id,
        name: 'Beta Fitout',
      },
    },
    update: {},
    create: {
      companyId: contractorCompany.id,
      name: 'Beta Fitout',
      description: 'Interior fitout for retail space',
      type: 'Residential',
      status: 'ONGOING',
      plannedBudget: 150000,
      currency: 'AUD',
      startDate: new Date('2026-01-15'),
      expectedEndDate: new Date('2026-06-30'),
      createdByUserId: procurementOfficer.id,
      pointOfContactId: companyAdmin.id,
    },
  });

  // Beta Project locations
  const betaLocationsExist = await prisma.projectLocation.count({
    where: { projectId: betaProject.id },
  });
  if (betaLocationsExist === 0) {
    await prisma.projectLocation.createMany({
      data: [
        {
          projectId: betaProject.id,
          type: 'DELIVERY',
          address: '78 King St, Melbourne VIC 3000',
          label: 'Retail Unit 5',
          isDefault: true,
        },
        {
          projectId: betaProject.id,
          type: 'DELIVERY',
          address: '80 King St, Melbourne VIC 3000',
          label: 'Rear Access',
          isDefault: false,
        },
        {
          projectId: betaProject.id,
          type: 'STORAGE',
          address: 'Unit 12, 90 Warehouse Rd, Tullamarine VIC 3043',
          label: 'Tullamarine Storage',
          isDefault: true,
        },
      ],
    });
  }

  // Beta Project members (CompanyAdmin + ProcurementOfficer, NOT FinancialOfficer)
  for (const userId of [companyAdmin.id, procurementOfficer.id]) {
    await prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId: betaProject.id, userId },
      },
      update: {},
      create: {
        projectId: betaProject.id,
        userId,
        assignedByUserId: companyAdmin.id,
      },
    });
  }

  console.log(`✅ Project: ${betaProject.name} (${betaProject.status})`);

  console.log('\n🎉 Seed complete!');
  // ── Activate vendor user for dashboard testing ──────────────────────────
  const vendorUser = await prisma.user.update({
    where: { email: 'vendor@testvendor.local' },
    data: {
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      invitationToken: null,
      invitationTokenExpiresAt: null,
    },
  });
  console.log(`\u2705 Activated: ${vendorUser.email}`);

  // Update vendorUser with contact info
  await prisma.user.update({
    where: { email: 'vendor@testvendor.local' },
    data: { position: 'Sales Director', phone: '+61 400 000 111' },
  });

  // Additional vendor contact for vendorCompany
  await prisma.user.upsert({
    where: { email: 'sales@testvendor.local' },
    update: {},
    create: {
      email: 'sales@testvendor.local',
      name: 'Mike Johnson',
      role: 'VENDOR',
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      companyId: vendorCompany.id,
      position: 'Sales Manager',
      phone: '+61 400 111 222',
    },
  });
  console.log('✅ Vendor contact: Mike Johnson (Test Vendor)');

  // ── Vendor assignment (link vendor company to contractor) ──────────────
  await prisma.companyVendorAssignment.upsert({
    where: {
      vendorId_contractorId: {
        vendorId: vendorCompany.id,
        contractorId: contractorCompany.id,
      },
    },
    update: {},
    create: {
      vendorId: vendorCompany.id,
      contractorId: contractorCompany.id,
    },
  });
  console.log('\u2705 Vendor assignment: VendorCo -> TestCo');

  // ════════════════════════════════════════════════════════════════════════
  // Epic 2 — Dashboard seed data
  // ════════════════════════════════════════════════════════════════════════

  console.log('\n\ud83c\udf31 Seeding Epic 2 dashboard data...');

  // ── Materials (needed for line items FK) ────────────────────────────────
  const category = await prisma.materialCategory.upsert({
    where: { name: 'Construction Materials' },
    update: {},
    create: { name: 'Construction Materials' },
  });

  const materialNames = ['Steel Rebar 12mm', 'Concrete Mix Grade 40'];
  const materialUoms = ['tonnes', 'm3'];
  const materials: Array<{ id: string; name: string }> = [];
  for (let m = 0; m < materialNames.length; m++) {
    const mat = await prisma.material.upsert({
      where: { name_status: { name: materialNames[m], status: 'PUBLIC' } },
      update: {},
      create: {
        name: materialNames[m],
        categoryId: category.id,
        uom: materialUoms[m],
        description: m === 0 ? 'High-tensile steel reinforcement bars' : 'Ready-mix concrete',
        status: 'PUBLIC',
        createdById: companyAdmin.id,
      },
    });
    materials.push(mat);
  }
  console.log(`\u2705 Materials: ${materials.length} created`);

  // ── Fetch ProjectLocation IDs for delivery location FK ──────────────────
  const alphaDeliveryLocation = await prisma.projectLocation.findFirst({
    where: { projectId: alphaProject.id, type: 'DELIVERY', isDefault: true },
  });
  const betaDeliveryLocation = await prisma.projectLocation.findFirst({
    where: { projectId: betaProject.id, type: 'DELIVERY', isDefault: true },
  });

  // ── RFQs ───────────────────────────────────────────────────────────────
  const rfqIds: string[] = [];
  const rfqStatuses: Array<'DRAFT' | 'OPEN' | 'AWAITING_RESPONSE' | 'AWARDED' | 'CLOSED'> = [
    'DRAFT',
    'OPEN',
    'AWAITING_RESPONSE',
    'AWARDED',
    'CLOSED',
  ];

  for (let i = 0; i < 5; i++) {
    const projectId = i % 2 === 0 ? alphaProject.id : betaProject.id;
    const locationId = i % 2 === 0 ? alphaDeliveryLocation?.id : betaDeliveryLocation?.id;
    const rfqNumber = `RFQ-${String(i + 1).padStart(5, '0')}`;
    const rfq = await prisma.rfq.upsert({
      where: { rfqNumber },
      update: {},
      create: {
        rfqNumber,
        projectId,
        companyId: contractorCompany.id,
        status: rfqStatuses[i],
        deliveryLocationId: locationId ?? null,
        pickUpLocation: i % 2 === 0 ? 'Warehouse B, 45 Industrial Ave' : null,
        deadlineStart: new Date('2026-04-01'),
        deadlineEnd: new Date('2026-04-15'),
        totalRequestedQty: (i + 1) * 100,
        approvalStatus: i === 3 ? 'APPROVED' : null,
        approvedById: i === 3 ? companyAdmin.id : null,
        createdByUserId: i % 2 === 0 ? procurementOfficer.id : companyAdmin.id,
      },
    });
    rfqIds.push(rfq.id);

    // Invite vendor to each RFQ
    await prisma.rfqVendor.upsert({
      where: { rfqId_vendorId: { rfqId: rfq.id, vendorId: vendorCompany.id } },
      update: {},
      create: { rfqId: rfq.id, vendorId: vendorCompany.id },
    });

    // Add 2 line items per RFQ (skip if already exist)
    const existingItems = await prisma.rfqLineItem.count({ where: { rfqId: rfq.id } });
    if (existingItems === 0) {
      for (let j = 0; j < 2; j++) {
        await prisma.rfqLineItem.create({
          data: {
            rfqId: rfq.id,
            materialId: materials[j].id,
            quantity: (i + 1) * 50 + j * 25,
            unit: materialUoms[j],
            description: j === 0 ? 'High-tensile steel reinforcement bars' : 'Ready-mix concrete',
          },
        });
      }
    }
  }
  console.log(`\u2705 RFQs: ${rfqIds.length} created with line items`);

  // ── Quote Responses ────────────────────────────────────────────────────
  let quotesCreated = 0;
  for (let i = 0; i < 3; i++) {
    const existingQuote = await prisma.quoteResponse.findFirst({
      where: { rfqId: rfqIds[i + 1], vendorId: vendorCompany.id },
    });
    if (existingQuote) {
      quotesCreated++;
      continue;
    }
    await prisma.quoteResponse.create({
      data: {
        rfqId: rfqIds[i + 1], // Link to Open, AwaitingResponse, Awarded RFQs
        vendorId: vendorCompany.id,
        totalCost: (i + 1) * 15000.5,
        discountPercent: i === 2 ? 5.0 : null,
        discountAmount: i === 2 ? 750.25 : null,
        itemsCovered: 2,
        totalItems: 2,
        status: i === 2 ? 'APPROVED' : 'PENDING',
        submittedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      },
    });
  }
  console.log(`\u2705 Quote Responses: ${quotesCreated} created`);

  // ── Purchase Orders ────────────────────────────────────────────────────
  const poIds: string[] = [];
  const poStatuses: Array<
    'DRAFT' | 'SENT' | 'ACKNOWLEDGED' | 'SCHEDULED_FOR_DELIVERY' | 'DELIVERED'
  > = ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'SCHEDULED_FOR_DELIVERY', 'DELIVERED'];
  const poTypes: Array<'STANDARD' | 'BULK' | 'HOLD_FOR_RELEASE'> = [
    'STANDARD',
    'STANDARD',
    'BULK',
    'HOLD_FOR_RELEASE',
    'STANDARD',
  ];

  for (let i = 0; i < 5; i++) {
    const projectId = i % 2 === 0 ? alphaProject.id : betaProject.id;
    const locationId = i % 2 === 0 ? alphaDeliveryLocation?.id : betaDeliveryLocation?.id;
    const poNumber = `PO-${String(i + 1).padStart(5, '0')}`;
    const po = await prisma.purchaseOrder.upsert({
      where: { poNumber },
      update: {},
      create: {
        poNumber,
        projectId,
        companyId: contractorCompany.id,
        vendorId: vendorCompany.id,
        status: poStatuses[i],
        poType: poTypes[i],
        approvalStatus: i >= 2 ? 'APPROVED' : 'NOT_REQUIRED',
        sourceOfCreation: 'MANUAL',
        revision: i < 3 ? 1 : 2,
        pickUp: i % 2 === 0,
        deliveryLocationId: i % 2 !== 0 ? (locationId ?? null) : null,
        pickUpLocation: i % 2 === 0 ? 'Warehouse B, 45 Industrial Ave' : null,
        currency: 'AUD',
        subtotal: (i + 1) * 22000.0,
        taxAmount: (i + 1) * 3000.0,
        totalAmount: (i + 1) * 25000.0,
        lineItemCount: (i + 1) * 2,
        totalRequestedQty: (i + 1) * 10,
        deadlineStart: new Date('2026-04-01'),
        deadlineEnd: new Date('2026-05-15'),
        approvedById: i >= 2 ? companyAdmin.id : null,
        createdByUserId: procurementOfficer.id,
      },
    });
    poIds.push(po.id);

    // Add line items per PO (skip if already exist)
    const existingPoItems = await prisma.poLineItem.count({ where: { purchaseOrderId: po.id } });
    if (existingPoItems === 0) {
      const itemCount = (i + 1) * 2;
      for (let j = 0; j < itemCount; j++) {
        const matIdx = j % materials.length;
        const unitPrice = 100.0 + j * 50;
        const qty = 10 + j * 5;
        await prisma.poLineItem.create({
          data: {
            purchaseOrderId: po.id,
            lineNumber: j + 1,
            materialId: materials[matIdx].id,
            materialCode: `MAT-${String(matIdx + 1).padStart(3, '0')}`,
            description: materials[matIdx].name,
            quantityOrdered: qty,
            quantityDelivered: poStatuses[i] === 'DELIVERED' ? qty : 0,
            unitOfMeasure: materialUoms[matIdx],
            unitPrice,
            lineTotal: unitPrice * qty,
            costCode: `CC-${String(j + 1).padStart(3, '0')}`,
            expectedDeliveryDate: new Date('2026-04-15'),
            deliveryLocationId: locationId ?? null,
            notes: j === 0 ? 'Urgent delivery required' : null,
          },
        });
      }
    }
  }
  console.log(`\u2705 Purchase Orders: ${poIds.length} created with line items`);

  // ── Bulk Orders ────────────────────────────────────────────────────────
  const bulkOrderIds: string[] = [];

  for (let i = 0; i < 2; i++) {
    const projectId = i === 0 ? alphaProject.id : betaProject.id;
    const existingBO = await prisma.bulkOrder.findFirst({
      where: {
        projectId,
        companyId: contractorCompany.id,
        vendorId: vendorCompany.id,
        brands: i === 0 ? 'BlueScope, OneSteel' : 'Boral, Holcim',
      },
    });
    if (existingBO) {
      bulkOrderIds.push(existingBO.id);
      continue;
    }
    const bo = await prisma.bulkOrder.create({
      data: {
        projectId: i === 0 ? alphaProject.id : betaProject.id,
        companyId: contractorCompany.id,
        vendorId: vendorCompany.id,
        rfqId: i === 0 ? rfqIds[3] : null, // Link first to Awarded RFQ
        status: 'ACTIVE',
        brands: i === 0 ? 'BlueScope, OneSteel' : 'Boral, Holcim',
        totalAmount: (i + 1) * 100000.0,
        endDate: new Date('2026-12-31'),
        createdByUserId: procurementOfficer.id,
      },
    });
    bulkOrderIds.push(bo.id);

    // Add 3 line items per bulk order
    for (let j = 0; j < 3; j++) {
      const qty = (j + 1) * 500;
      const ordered = Math.floor(qty * 0.3);
      const pricePerUnit = (j + 1) * 45.5;
      await prisma.bulkOrderLineItem.create({
        data: {
          bulkOrderId: bo.id,
          itemReference: `BO-${i + 1}-ITEM-${j + 1}`,
          description: ['Steel Beams HEA200', 'Concrete Blocks 400x200', 'Rebar Mesh SL82'][j],
          qty,
          unit: ['tonnes', 'pallets', 'sheets'][j],
          ordered,
          qtyRemaining: qty - ordered,
          deliveriesPercent: Math.round((ordered / qty) * 100 * 100) / 100,
          pricePerUnit,
          totalLineInc: qty * pricePerUnit,
        },
      });
    }
  }
  console.log(`\u2705 Bulk Orders: ${bulkOrderIds.length} created with line items`);

  // ── Additional Vendor companies (for diverse dashboard data) ────────
  const vendorCompany2 = await prisma.company.upsert({
    where: { abn: 'TEST-VENDOR-002' },
    update: {},
    create: {
      type: 'VENDOR',
      legalName: 'Acme Building Supplies',
      tradeName: 'AcmeBS',
      abn: 'TEST-VENDOR-002',
      contactEmail: 'info@acmebs.local',
      status: 'ACTIVE',
      specialisations: ['Timber', 'Roofing'],
      legalAddress: '88 Timber Road, Blacktown NSW 2148',
    },
  });
  await prisma.companyVendorAssignment.upsert({
    where: {
      vendorId_contractorId: {
        vendorId: vendorCompany2.id,
        contractorId: contractorCompany.id,
      },
    },
    update: {},
    create: { vendorId: vendorCompany2.id, contractorId: contractorCompany.id },
  });

  const vendorCompany3 = await prisma.company.upsert({
    where: { abn: 'TEST-VENDOR-003' },
    update: {},
    create: {
      type: 'VENDOR',
      legalName: 'Delta Electrical Services',
      tradeName: 'DeltaElec',
      abn: 'TEST-VENDOR-003',
      contactEmail: 'info@deltaelec.local',
      status: 'ACTIVE',
      specialisations: ['Electrical', 'Lighting'],
      legalAddress: '5 Spark Avenue, Parramatta NSW 2150',
    },
  });
  await prisma.companyVendorAssignment.upsert({
    where: {
      vendorId_contractorId: {
        vendorId: vendorCompany3.id,
        contractorId: contractorCompany.id,
      },
    },
    update: {},
    create: { vendorId: vendorCompany3.id, contractorId: contractorCompany.id },
  });

  const vendorCompany4 = await prisma.company.upsert({
    where: { abn: 'TEST-VENDOR-004' },
    update: {},
    create: {
      type: 'VENDOR',
      legalName: 'Summit Plumbing Solutions',
      tradeName: 'SummitPlumb',
      abn: 'TEST-VENDOR-004',
      contactEmail: 'info@summitplumb.local',
      status: 'ACTIVE',
      specialisations: ['Plumbing', 'HVAC'],
      legalAddress: '200 Pipe Street, Liverpool NSW 2170',
    },
  });
  await prisma.companyVendorAssignment.upsert({
    where: {
      vendorId_contractorId: {
        vendorId: vendorCompany4.id,
        contractorId: contractorCompany.id,
      },
    },
    update: {},
    create: { vendorId: vendorCompany4.id, contractorId: contractorCompany.id },
  });

  console.log('✅ Additional vendor companies: 3 created');

  // ── Vendor contact users for additional companies ─────────────────────
  // vendorCompany2 contacts
  await prisma.user.upsert({
    where: { email: 'admin@acmebs.local' },
    update: {},
    create: {
      email: 'admin@acmebs.local',
      name: 'Sarah Williams',
      role: 'VENDOR',
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      companyId: vendorCompany2.id,
      position: 'Account Manager',
      phone: '+61 400 333 444',
    },
  });
  await prisma.user.upsert({
    where: { email: 'sales@acmebs.local' },
    update: {},
    create: {
      email: 'sales@acmebs.local',
      name: 'Tom Brown',
      role: 'VENDOR',
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      companyId: vendorCompany2.id,
      position: 'Sales Rep',
      phone: '+61 400 555 666',
    },
  });

  // vendorCompany3 contacts
  await prisma.user.upsert({
    where: { email: 'admin@deltaelec.local' },
    update: {},
    create: {
      email: 'admin@deltaelec.local',
      name: 'Emily Chen',
      role: 'VENDOR',
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      companyId: vendorCompany3.id,
      position: 'Regional Manager',
      phone: '+61 400 777 888',
    },
  });
  await prisma.user.upsert({
    where: { email: 'projects@deltaelec.local' },
    update: {},
    create: {
      email: 'projects@deltaelec.local',
      name: 'James Lee',
      role: 'VENDOR',
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      companyId: vendorCompany3.id,
      position: 'Project Coordinator',
      phone: '+61 400 999 000',
    },
  });

  // vendorCompany4 contacts
  await prisma.user.upsert({
    where: { email: 'admin@summitplumb.local' },
    update: {},
    create: {
      email: 'admin@summitplumb.local',
      name: 'David Park',
      role: 'VENDOR',
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      companyId: vendorCompany4.id,
      position: 'Business Development',
      phone: '+61 400 123 456',
    },
  });

  console.log('✅ Vendor contact users: 6 created');

  // ── Invite additional vendors to existing RFQs ─────────────────────
  const additionalVendorInvites: Record<number, string[]> = {
    0: [vendorCompany2.id],
    1: [vendorCompany2.id, vendorCompany3.id],
    2: [vendorCompany3.id, vendorCompany4.id],
    3: [vendorCompany2.id, vendorCompany3.id, vendorCompany4.id],
    4: [vendorCompany4.id],
  };

  for (let i = 0; i < rfqIds.length; i++) {
    const addVendors = additionalVendorInvites[i] ?? [];
    for (const addVendorId of addVendors) {
      await prisma.rfqVendor.upsert({
        where: { rfqId_vendorId: { rfqId: rfqIds[i], vendorId: addVendorId } },
        update: {},
        create: { rfqId: rfqIds[i], vendorId: addVendorId },
      });
    }
  }
  console.log('✅ Additional vendor invitations added to RFQs');

  // ── Invoices (expanded for all dashboard scenarios) ──────────────────
  const allVendors = [vendorCompany, vendorCompany2, vendorCompany3, vendorCompany4];
  const invoiceSeedData: Array<{
    status: 'PENDING' | 'APPROVED' | 'DISPUTED' | 'PAID' | 'REJECTED';
    amount: number;
    dueDaysOffset: number;
    vendorIdx: number;
    projectIdx: number;
    poIdx: number | null;
  }> = [
    // 5 PENDING invoices (for "Invoices pending approval")
    { status: 'PENDING', amount: 45200.0, dueDaysOffset: 3, vendorIdx: 0, projectIdx: 0, poIdx: 0 },
    { status: 'PENDING', amount: 18750.5, dueDaysOffset: 5, vendorIdx: 1, projectIdx: 1, poIdx: 1 },
    {
      status: 'PENDING',
      amount: 92100.0,
      dueDaysOffset: -2,
      vendorIdx: 2,
      projectIdx: 0,
      poIdx: 2,
    },
    {
      status: 'PENDING',
      amount: 12350.25,
      dueDaysOffset: 1,
      vendorIdx: 3,
      projectIdx: 1,
      poIdx: 3,
    },
    { status: 'PENDING', amount: 7400.0, dueDaysOffset: 6, vendorIdx: 0, projectIdx: 0, poIdx: 4 },
    // 5 DISPUTED invoices (for "Disputed Invoices")
    {
      status: 'DISPUTED',
      amount: 33500.0,
      dueDaysOffset: -5,
      vendorIdx: 1,
      projectIdx: 0,
      poIdx: 0,
    },
    {
      status: 'DISPUTED',
      amount: 67800.75,
      dueDaysOffset: -10,
      vendorIdx: 2,
      projectIdx: 1,
      poIdx: 1,
    },
    {
      status: 'DISPUTED',
      amount: 15200.0,
      dueDaysOffset: -3,
      vendorIdx: 0,
      projectIdx: 0,
      poIdx: 2,
    },
    {
      status: 'DISPUTED',
      amount: 41900.5,
      dueDaysOffset: -7,
      vendorIdx: 3,
      projectIdx: 1,
      poIdx: null,
    },
    {
      status: 'DISPUTED',
      amount: 28600.0,
      dueDaysOffset: -1,
      vendorIdx: 1,
      projectIdx: 0,
      poIdx: 3,
    },
    // 1 APPROVED, 1 PAID, 1 REJECTED (to cover all statuses)
    {
      status: 'APPROVED',
      amount: 25001.5,
      dueDaysOffset: -14,
      vendorIdx: 0,
      projectIdx: 1,
      poIdx: 4,
    },
    { status: 'PAID', amount: 50003.0, dueDaysOffset: -21, vendorIdx: 2, projectIdx: 0, poIdx: 0 },
    {
      status: 'REJECTED',
      amount: 8750.25,
      dueDaysOffset: -30,
      vendorIdx: 3,
      projectIdx: 1,
      poIdx: null,
    },
  ];

  const projects = [alphaProject, betaProject];
  const invoiceIds: string[] = [];

  for (let i = 0; i < invoiceSeedData.length; i++) {
    const inv = invoiceSeedData[i];
    const id = randomUUID();
    invoiceIds.push(id);
    await prisma.invoice.upsert({
      where: { id },
      update: {},
      create: {
        id,
        projectId: projects[inv.projectIdx].id,
        companyId: contractorCompany.id,
        vendorId: allVendors[inv.vendorIdx].id,
        relatedPoId: inv.poIdx !== null ? poIds[inv.poIdx] : null,
        status: inv.status,
        totalAmount: inv.amount,
        dueDate: new Date(Date.now() + inv.dueDaysOffset * 24 * 60 * 60 * 1000),
        createdByUserId: vendorUser.id,
      },
    });
  }
  console.log(`✅ Invoices: ${invoiceIds.length} created (5 PENDING, 5 DISPUTED, 3 other)`);

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // FOR-197 \u2014 M:N vendor relationship test data
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

  console.log('\n\ud83c\udf31 Seeding FOR-197 M:N vendor data (Rexel x 2 contractors)...');

  const northsideContractor = await prisma.company.upsert({
    where: { abn: 'TEST-CONTRACTOR-002' },
    update: {},
    create: {
      type: 'CONTRACTOR',
      legalName: 'Northside Builders Pty Ltd',
      tradeName: 'Northside',
      abn: 'TEST-CONTRACTOR-002',
      contactEmail: 'admin@northside.local',
      status: 'ACTIVE',
      specialisations: ['Residential', 'Commercial'],
    },
  });
  console.log(`\u2705 Contractor company: ${northsideContractor.legalName}`);

  const northsideAdmin = await prisma.user.upsert({
    where: { email: 'companyadmin@northside.local' },
    update: {},
    create: {
      email: 'companyadmin@northside.local',
      name: 'Northside Admin',
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      companyId: northsideContractor.id,
    },
  });

  const northsideProcurement = await prisma.user.upsert({
    where: { email: 'procurement@northside.local' },
    update: {},
    create: {
      email: 'procurement@northside.local',
      name: 'Northside Procurement',
      role: 'PROCUREMENT_OFFICER',
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      companyId: northsideContractor.id,
    },
  });

  const northsideProject = await prisma.project.upsert({
    where: {
      companyId_name: { companyId: northsideContractor.id, name: 'Riverside Apartments' },
    },
    update: {},
    create: {
      companyId: northsideContractor.id,
      name: 'Riverside Apartments',
      description: '40-unit residential build',
      type: 'Residential',
      status: 'ONGOING',
      plannedBudget: 800000,
      currency: 'AUD',
      startDate: new Date('2026-02-01'),
      expectedEndDate: new Date('2026-12-31'),
      createdByUserId: northsideAdmin.id,
      pointOfContactId: northsideProcurement.id,
    },
  });

  const northsideLocationExists = await prisma.projectLocation.count({
    where: { projectId: northsideProject.id },
  });
  if (northsideLocationExists === 0) {
    await prisma.projectLocation.create({
      data: {
        projectId: northsideProject.id,
        type: 'DELIVERY',
        address: '500 River Rd, Brisbane QLD 4000',
        label: 'Riverside Site',
        isDefault: true,
      },
    });
  }

  for (const userId of [northsideAdmin.id, northsideProcurement.id]) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: northsideProject.id, userId } },
      update: {},
      create: {
        projectId: northsideProject.id,
        userId,
        assignedByUserId: northsideAdmin.id,
      },
    });
  }

  // Rexel: ONE vendor row shared by both contractors
  const rexelVendor = await prisma.company.upsert({
    where: { abn: 'TEST-VENDOR-REXEL' },
    update: {},
    create: {
      type: 'VENDOR',
      legalName: 'Rexel Electrical Supplies',
      tradeName: 'Rexel',
      abn: 'TEST-VENDOR-REXEL',
      contactEmail: 'orders@rexel.local',
      status: 'ACTIVE',
      specialisations: ['ELECTRICAL', 'LIGHTING'],
      legalAddress: '100 Voltage Way, Sydney NSW 2000',
    },
  });
  console.log(`\u2705 Shared vendor: ${rexelVendor.legalName} (single Company row)`);

  for (const contractorId of [contractorCompany.id, northsideContractor.id]) {
    await prisma.companyVendorAssignment.upsert({
      where: {
        vendorId_contractorId: { vendorId: rexelVendor.id, contractorId },
      },
      update: {},
      create: { vendorId: rexelVendor.id, contractorId },
    });
  }
  console.log('\u2705 Vendor assignments: Rexel -> TestCo + Northside');

  await prisma.user.upsert({
    where: { email: 'rep@rexel.local' },
    update: {},
    create: {
      email: 'rep@rexel.local',
      name: 'Rachel Rex',
      role: 'VENDOR',
      status: 'ACTIVE',
      passwordHash: testPasswordHash,
      companyId: rexelVendor.id,
      position: 'Senior Sales',
      phone: '+61 400 444 555',
    },
  });

  const northsideDeliveryLocation = await prisma.projectLocation.findFirst({
    where: { projectId: northsideProject.id, type: 'DELIVERY', isDefault: true },
  });

  const rexelLoopSpecs = [
    {
      contractor: contractorCompany,
      project: alphaProject,
      deliveryLocation: alphaDeliveryLocation,
      createdBy: procurementOfficer,
      rfqNumber: 'RFQ-REXEL-001',
    },
    {
      contractor: northsideContractor,
      project: northsideProject,
      deliveryLocation: northsideDeliveryLocation,
      createdBy: northsideProcurement,
      rfqNumber: 'RFQ-REXEL-002',
    },
  ];

  for (const spec of rexelLoopSpecs) {
    const rfq = await prisma.rfq.upsert({
      where: { rfqNumber: spec.rfqNumber },
      update: {},
      create: {
        rfqNumber: spec.rfqNumber,
        projectId: spec.project.id,
        companyId: spec.contractor.id,
        status: 'AWARDED',
        deliveryLocationId: spec.deliveryLocation?.id ?? null,
        deadlineStart: new Date('2026-06-01'),
        deadlineEnd: new Date('2026-06-15'),
        totalRequestedQty: 250,
        createdByUserId: spec.createdBy.id,
      },
    });

    await prisma.rfqVendor.upsert({
      where: { rfqId_vendorId: { rfqId: rfq.id, vendorId: rexelVendor.id } },
      update: {},
      create: { rfqId: rfq.id, vendorId: rexelVendor.id },
    });

    const lineCount = await prisma.rfqLineItem.count({ where: { rfqId: rfq.id } });
    if (lineCount === 0) {
      await prisma.rfqLineItem.create({
        data: {
          rfqId: rfq.id,
          materialId: materials[0].id,
          quantity: 250,
          unit: materialUoms[0],
          description: 'Electrical rebar bundle',
        },
      });
    }

    const existingQuote = await prisma.quoteResponse.findFirst({
      where: { rfqId: rfq.id, vendorId: rexelVendor.id },
    });
    if (!existingQuote) {
      await prisma.quoteResponse.create({
        data: {
          rfqId: rfq.id,
          vendorId: rexelVendor.id,
          totalCost: 32500.0,
          itemsCovered: 1,
          totalItems: 1,
          status: 'APPROVED',
          submittedAt: new Date(),
        },
      });
    }
  }
  console.log('\u2705 RFQ -> quote loop: 2 RFQs (one per contractor) routed through Rexel');

  const rexelRows = await prisma.company.count({
    where: { type: 'VENDOR', contactEmail: 'orders@rexel.local' },
  });
  const rexelAssignments = await prisma.companyVendorAssignment.count({
    where: { vendorId: rexelVendor.id },
  });
  console.log(
    `\ud83d\udcca M:N invariant - Rexel Company rows: ${rexelRows} (expected 1), assignments: ${rexelAssignments} (expected 2)`,
  );

  console.log('\n\ud83c\udf89 Seed complete!');
  console.log('\n\ud83d\udccb Login credentials:');
  console.log('  Super Admin: superadmin@forethread.local / Dev@123456');
  console.log('  Company Admin: companyadmin@testcontractor.local / Dev@123456');
  console.log('  Procurement Officer: procurement@testcontractor.local / Dev@123456');
  console.log('  Financial Officer: financial@testcontractor.local / Dev@123456');
  console.log('  Vendor: vendor@testvendor.local / Dev@123456');
  console.log('  Warehouse Officer: warehouse@testcontractor.local / Dev@123456');
  console.log('  Foreman: foreman@testcontractor.local / Dev@123456');
  console.log('  Northside Admin: companyadmin@northside.local / Dev@123456');
  console.log('  Northside Procurement: procurement@northside.local / Dev@123456');
  console.log('\n\ud83d\udccb Test projects:');
  console.log('  Alpha Construction (Planned) \u2014 2 members');
  console.log('  Beta Fitout (Ongoing) \u2014 2 members');
  console.log(
    '  Note: FinancialOfficer is NOT assigned to any project (for access control testing)',
  );
  console.log('\n\ud83d\udccb Epic 2 dashboard data:');
  console.log('  5 RFQs (Draft, Open, AwaitingResponse, Awarded, Closed)');
  console.log('  3 Quote Responses from VendorCo');
  console.log('  5 Purchase Orders (Draft, Sent, Acknowledged, PendingDelivery, Delivered)');
  console.log('  2 Bulk Orders with 3 line items each');
  console.log('  5 Invoices (Pending, Approved, Disputed, Paid, Rejected)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
