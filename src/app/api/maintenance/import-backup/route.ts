import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const backupData = await req.json();

    const report: Record<string, { total: number; inserted: number; errors: number; details?: string[] }> = {
      franquias: { total: 0, inserted: 0, errors: 0, details: [] },
      courses: { total: 0, inserted: 0, errors: 0, details: [] },
      users: { total: 0, inserted: 0, errors: 0, details: [] },
      companies: { total: 0, inserted: 0, errors: 0, details: [] },
      vagas: { total: 0, inserted: 0, errors: 0, details: [] },
      missions: { total: 0, inserted: 0, errors: 0, details: [] },
      applications: { total: 0, inserted: 0, errors: 0, details: [] },
    };

    const parseDate = (d: any) => (d && typeof d === "string" && d.trim().length > 0 ? d : null);

    // 1. Franquias
    if (backupData.franquias?.length) {
      report.franquias.total = backupData.franquias.length;
      const rows = backupData.franquias.map((f: any) => ({
        id: f._id || f.id,
        nome: f.nome || "Unidade",
        cidade: f.cidade || null,
        created_at: parseDate(f.createdAt) || new Date().toISOString(),
      }));
      const { error } = await supabaseAdmin.from("franquias").upsert(rows, { onConflict: "id" });
      if (error) {
        report.franquias.errors += rows.length;
        report.franquias.details?.push(error.message);
      } else {
        report.franquias.inserted += rows.length;
      }
    }

    // 2. Cursos
    if (backupData.courses?.length) {
      report.courses.total = backupData.courses.length;
      const rows = backupData.courses.map((c: any) => ({
        id: c._id || c.id,
        title: c.title || "Curso",
        description: c.description || null,
        badges: Array.isArray(c.badges) ? c.badges : [],
        created_at: parseDate(c.createdAt) || new Date().toISOString(),
      }));
      const { error } = await supabaseAdmin.from("cursos").upsert(rows, { onConflict: "id" });
      if (error) {
        report.courses.errors += rows.length;
        report.courses.details?.push(error.message);
      } else {
        report.courses.inserted += rows.length;
      }
    }

    // 3. Usuários
    if (backupData.users?.length) {
      report.users.total = backupData.users.length;
      const validFranquiaIds = new Set((backupData.franquias || []).map((f: any) => f._id || f.id));

      const rows = backupData.users.map((u: any) => ({
        id: u._id || u.id,
        uid: u.uid ? String(u.uid) : null,
        email: u.email ? u.email.toLowerCase().trim() : `${u.codigo || u._id}@mult.com.br`,
        display_name: u.displayName || u.nome || "Aluno",
        codigo: u.codigo ? String(u.codigo) : null,
        role: u.role || "aluno",
        franquia_id: validFranquiaIds.has(u.franquiaId) ? u.franquiaId : null,
        turma: u.turma || null,
        xp: Number(u.xp) || 0,
        skills: Array.isArray(u.skills) ? u.skills : [],
        resume_url: u.resumeUrl || null,
        availability_status: u.availabilityStatus || "Disponível",
        withdrawal_reason: u.withdrawalReason || null,
        unlocked_badges: Array.isArray(u.unlockedBadges) ? u.unlockedBadges : [],
        current_course_id: u.currentCourseId || "INF",
        ats_terms_accepted: Boolean(u.atsTermsAccepted),
        ats_terms_accepted_at: parseDate(u.atsTermsAcceptedAt),
        perceptions: u.perceptions && typeof u.perceptions === "object" ? u.perceptions : {},
        employment_history: Array.isArray(u.employmentHistory) ? u.employmentHistory : [],
        created_at: parseDate(u.createdAt) || new Date().toISOString(),
        last_login: parseDate(u.lastLogin),
      }));

      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await supabaseAdmin.from("usuarios").upsert(batch, { onConflict: "id" });
        if (error) {
          report.users.errors += batch.length;
          report.users.details?.push(error.message);
        } else {
          report.users.inserted += batch.length;
        }
      }
    }

    // 4. Empresas
    const companyIdMap: Record<string, string> = {};
    if (backupData.companies?.length) {
      report.companies.total = backupData.companies.length;
      for (const c of backupData.companies) {
        const { data, error } = await supabaseAdmin
          .from("empresas")
          .upsert(
            {
              legacy_id: c._id || c.id,
              name: c.name || "Empresa Parceira",
              contact_person: c.contactPerson || null,
              phone: c.phone || null,
              franquia_id: c.franquiaId || null,
              created_at: parseDate(c.createdAt) || new Date().toISOString(),
            },
            { onConflict: "legacy_id" }
          )
          .select("id, legacy_id")
          .single();

        if (data) {
          companyIdMap[c._id || c.id] = data.id;
          report.companies.inserted++;
        } else {
          report.companies.errors++;
          if (error) report.companies.details?.push(error.message);
        }
      }
    }

    // 5. Vagas
    const jobIdMap: Record<string, string> = {};
    if (backupData.job_postings?.length) {
      report.vagas.total = backupData.job_postings.length;
      for (const j of backupData.job_postings) {
        const mappedCompanyId = companyIdMap[j.companyId] || null;
        const { data, error } = await supabaseAdmin
          .from("vagas")
          .upsert(
            {
              legacy_id: j._id || j.id,
              title: j.title || "Vaga",
              company_id: mappedCompanyId,
              company_name: j.companyName || "Empresa Parceira",
              franquia_id: j.franquiaId || null,
              description: j.description || "",
              required_skills: Array.isArray(j.requiredSkills) ? j.requiredSkills : [],
              status: j.status || "aberta",
              opening_date: parseDate(j.openingDate),
              closing_forecast: parseDate(j.closingForecast),
              selection_process_type: j.selectionProcessType || "Entrevista Presencial",
              created_by_uid: j.createdByUid ? String(j.createdByUid) : null,
              created_at: parseDate(j.createdAt) || new Date().toISOString(),
            },
            { onConflict: "legacy_id" }
          )
          .select("id, legacy_id")
          .single();

        if (data) {
          jobIdMap[j._id || j.id] = data.id;
          report.vagas.inserted++;
        } else {
          report.vagas.errors++;
          if (error) report.vagas.details?.push(error.message);
        }
      }
    }

    // 6. Missões
    if (backupData.missions?.length) {
      report.missions.total = backupData.missions.length;
      const validUserIds = new Set((backupData.users || []).map((u: any) => u._id || u.id));
      const validFranquiaIds = new Set((backupData.franquias || []).map((f: any) => f._id || f.id));

      const rows = backupData.missions
        .filter((m: any) => validUserIds.has(m.studentId))
        .map((m: any) => ({
          legacy_id: m._id || m.id,
          student_id: m.studentId,
          student_name: m.studentName || null,
          franquia_id: validFranquiaIds.has(m.franquiaId) ? m.franquiaId : null,
          turma: m.turma || null,
          course_id: m.courseId || null,
          course_name: m.courseName || null,
          module: m.module || "Geral",
          class_num: Number(m.classNum) || 1,
          content: m.content || "",
          status: m.status || "pending",
          ai_feedback: m.aiFeedback || null,
          xp_awarded: Number(m.xpAwarded) || 0,
          created_at: parseDate(m.createdAt) || new Date().toISOString(),
          approved_at: parseDate(m.approvedAt),
          approved_by: m.approvedBy ? String(m.approvedBy) : null,
        }));

      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await supabaseAdmin.from("missoes").upsert(batch, { onConflict: "legacy_id" });
        if (error) {
          report.missions.errors += batch.length;
          report.missions.details?.push(error.message);
        } else {
          report.missions.inserted += batch.length;
        }
      }
    }

    // 7. Candidaturas
    if (backupData.applications?.length) {
      report.applications.total = backupData.applications.length;
      const validUserIds = new Set((backupData.users || []).map((u: any) => u._id || u.id));

      for (const a of backupData.applications) {
        const mappedJobId = jobIdMap[a.jobId] || null;
        if (!mappedJobId || !validUserIds.has(a.studentId)) {
          report.applications.errors++;
          continue;
        }

        const { error } = await supabaseAdmin.from("candidaturas").upsert(
          {
            legacy_id: a._id || a.id,
            job_id: mappedJobId,
            student_id: a.studentId,
            match_score: Number(a.matchScore) || 0,
            status: a.status || "pendente",
            status_history: Array.isArray(a.statusHistory) ? a.statusHistory : [],
            applied_at: parseDate(a.appliedAt) || new Date().toISOString(),
          },
          { onConflict: "legacy_id" }
        );

        if (error) {
          report.applications.errors++;
          report.applications.details?.push(error.message);
        } else {
          report.applications.inserted++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error("Erro Crítico:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
