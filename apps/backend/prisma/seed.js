"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const argon2 = __importStar(require("argon2"));
const prisma = new client_1.PrismaClient();
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
            role: 'COMPANY_ADMIN',
            companyId: contractorCompany.id,
        },
        {
            email: 'procurement@testcontractor.local',
            name: 'Procurement Officer',
            role: 'PROCUREMENT_OFFICER',
            companyId: contractorCompany.id,
        },
        {
            email: 'financial@testcontractor.local',
            name: 'Financial Officer',
            role: 'FINANCIAL_OFFICER',
            companyId: contractorCompany.id,
        },
        {
            email: 'vendor@testvendor.local',
            name: 'Vendor User',
            role: 'VENDOR',
            companyId: vendorCompany.id,
        },
        {
            email: 'warehouse@testcontractor.local',
            name: 'Warehouse Officer',
            role: 'WAREHOUSE_OFFICER',
            companyId: contractorCompany.id,
        },
        {
            email: 'foreman@testcontractor.local',
            name: 'Foreman',
            role: 'FOREMAN',
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
    console.log(`✅ Activated: ${vendorUser.email}`);
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
    console.log('✅ Vendor assignment: VendorCo -> TestCo');
    // ════════════════════════════════════════════════════════════════════════
    // Epic 2 — Dashboard seed data
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🌱 Seeding Epic 2 dashboard data...');
    // ── Materials (needed for line items FK) ────────────────────────────────
    const category = await prisma.materialCategory.upsert({
        where: { name: 'Construction Materials' },
        update: {},
        create: { name: 'Construction Materials' },
    });
    const materialNames = ['Steel Rebar 12mm', 'Concrete Mix Grade 40'];
    const materialUoms = ['tonnes', 'm3'];
    const materials = [];
    for (let m = 0; m < materialNames.length; m++) {
        // Material has no (name, status) composite unique key, so guard-then-create
        // for idempotency instead of upserting on a non-existent unique constraint.
        const existing = await prisma.material.findFirst({
            where: { name: materialNames[m], status: 'PUBLIC' },
            select: { id: true, name: true },
        });
        const mat = existing ??
            (await prisma.material.create({
                data: {
                    name: materialNames[m],
                    categoryId: category.id,
                    uom: materialUoms[m],
                    description: m === 0 ? 'High-tensile steel reinforcement bars' : 'Ready-mix concrete',
                    status: 'PUBLIC',
                    createdById: companyAdmin.id,
                },
                select: { id: true, name: true },
            }));
        materials.push(mat);
    }
    console.log(`✅ Materials: ${materials.length} created`);
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
    // ════════════════════════════════════════════════════════════════════════
    // FOR-197 — M:N vendor relationship test data
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🌱 Seeding FOR-197 M:N vendor data (Rexel x 2 contractors)...');
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
    console.log(`✅ Contractor company: ${northsideContractor.legalName}`);
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
    console.log(`✅ Shared vendor: ${rexelVendor.legalName} (single Company row)`);
    for (const contractorId of [contractorCompany.id, northsideContractor.id]) {
        await prisma.companyVendorAssignment.upsert({
            where: {
                vendorId_contractorId: { vendorId: rexelVendor.id, contractorId },
            },
            update: {},
            create: { vendorId: rexelVendor.id, contractorId },
        });
    }
    console.log('✅ Vendor assignments: Rexel -> TestCo + Northside');
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
    const rexelRows = await prisma.company.count({
        where: { type: 'VENDOR', contactEmail: 'orders@rexel.local' },
    });
    const rexelAssignments = await prisma.companyVendorAssignment.count({
        where: { vendorId: rexelVendor.id },
    });
    console.log(`📊 M:N invariant - Rexel Company rows: ${rexelRows} (expected 1), assignments: ${rexelAssignments} (expected 2)`);
    console.log('\n🎉 Seed complete!');
    console.log('\n📋 Login credentials:');
    console.log('  Super Admin: superadmin@forethread.local / Dev@123456');
    console.log('  Company Admin: companyadmin@testcontractor.local / Dev@123456');
    console.log('  Procurement Officer: procurement@testcontractor.local / Dev@123456');
    console.log('  Financial Officer: financial@testcontractor.local / Dev@123456');
    console.log('  Vendor: vendor@testvendor.local / Dev@123456');
    console.log('  Warehouse Officer: warehouse@testcontractor.local / Dev@123456');
    console.log('  Foreman: foreman@testcontractor.local / Dev@123456');
    console.log('  Northside Admin: companyadmin@northside.local / Dev@123456');
    console.log('  Northside Procurement: procurement@northside.local / Dev@123456');
    console.log('\n📋 Test projects:');
    console.log('  Alpha Construction (Planned) — 2 members');
    console.log('  Beta Fitout (Ongoing) — 2 members');
    console.log('  Note: FinancialOfficer is NOT assigned to any project (for access control testing)');
}
main()
    .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
