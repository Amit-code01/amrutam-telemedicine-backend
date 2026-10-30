import { prisma } from '../../database/client.js';

export async function searchDoctors(query: {
  specialty?: string;
  q?: string;
  page: number;
  pageSize: number;
}) {
  const where = {
    isVerified: true,
    ...(query.specialty ? { specialty: { equals: query.specialty, mode: 'insensitive' as const } } : {}),
    ...(query.q ? { fullName: { contains: query.q, mode: 'insensitive' as const } } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.doctorProfile.findMany({
      where,
      select: { id: true, fullName: true, specialty: true, bio: true, consultationFee: true },
      orderBy: { fullName: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.doctorProfile.count({ where }),
  ]);
  return { items, page: query.page, pageSize: query.pageSize, total };
}

export async function updateDoctor(
  userId: string,
  data: { fullName?: string; specialty?: string; bio?: string; consultationFee?: number },
) {
  return prisma.doctorProfile.update({ where: { userId }, data });
}
