-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('Planned', 'Ongoing', 'Completed', 'Archived');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('Delivery', 'Storage');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(100),
    "status" "ProjectStatus" NOT NULL DEFAULT 'Planned',
    "planned_budget" DECIMAL(18,4),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'AUD',
    "start_date" DATE,
    "expected_end_date" DATE,
    "point_of_contact_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_locations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "address" TEXT NOT NULL,
    "label" VARCHAR(255),
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "project_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_user_id" TEXT,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_projects_company" ON "projects"("company_id");

-- CreateIndex
CREATE INDEX "idx_projects_company_status" ON "projects"("company_id", "status");

-- CreateIndex
CREATE INDEX "idx_projects_created_by" ON "projects"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_projects_company_name" ON "projects"("company_id", "name");

-- CreateIndex
CREATE INDEX "idx_projectlocation_project" ON "project_locations"("project_id");

-- CreateIndex
CREATE INDEX "idx_projectlocation_project_type" ON "project_locations"("project_id", "type");

-- CreateIndex
CREATE INDEX "idx_projectmember_project" ON "project_members"("project_id");

-- CreateIndex
CREATE INDEX "idx_projectmember_user" ON "project_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_projectmember_project_user" ON "project_members"("project_id", "user_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_point_of_contact_id_fkey" FOREIGN KEY ("point_of_contact_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_locations" ADD CONSTRAINT "project_locations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

